import { ErrorConflicto, ErrorNoEncontrado } from "../../../shared/errores";
import { normalizar } from "../../../shared/texto";
import type { ID } from "../../../shared/tipos";
import type { RepositorioLotes } from "../../compras/domain/repositorios";
import type {
  FilaLedgerCliente,
  FiltroVentas,
  NuevaVenta,
  NuevoPagoCliente,
  PagoCliente,
  ResumenCobroCliente,
  Venta,
  VentaDetalle,
} from "../domain/entidades";
import {
  agruparCobrosPorCliente,
  calcularValorTotal,
  construirLedgerCliente,
  validarAbonoCliente,
  validarNuevaVenta,
} from "../domain/entidades";
import type {
  RepositorioPagosCliente,
  RepositorioVentas,
} from "../domain/repositorios";

export interface CasosUsoVentas {
  listarVentas(filtro?: FiltroVentas): Promise<VentaDetalle[]>;
  obtenerVenta(id: ID): Promise<VentaDetalle>;
  /** Registra la venta y descuenta la existencia del lote. */
  registrarVenta(datos: NuevaVenta): Promise<Venta>;
  /** Elimina la venta y devuelve la existencia al lote. */
  anularVenta(id: ID): Promise<void>;

  listarAbonosDeVenta(ventaId: ID): Promise<PagoCliente[]>;
  registrarAbonoCliente(datos: NuevoPagoCliente): Promise<PagoCliente>;

  /** Saldos agrupados por cliente para la pantalla de cobros. */
  resumenCobrosPorCliente(filtro?: FiltroVentas): Promise<ResumenCobroCliente[]>;

  /**
   * Ledger histórico para el reporte: cada venta del filtro con cada uno de
   * sus abonos como fila propia, recortado al rango de fechas pedido.
   */
  listarMovimientosCliente(filtro?: FiltroVentas): Promise<FilaLedgerCliente[]>;
}

export function crearCasosUsoVentas(deps: {
  ventas: RepositorioVentas;
  pagos: RepositorioPagosCliente;
  lotes: RepositorioLotes;
}): CasosUsoVentas {
  const { ventas, pagos, lotes } = deps;

  /** Filtros que dependen de tablas embebidas y no se pueden expresar en la consulta. */
  function aplicarFiltrosDerivados(
    resultado: VentaDetalle[],
    filtro: FiltroVentas,
  ): VentaDetalle[] {
    let items = resultado;

    if (filtro.productoId) {
      items = items.filter((venta) => venta.lote?.productoId === filtro.productoId);
    }

    const busqueda = normalizar(filtro.busqueda);
    if (busqueda) {
      items = items.filter((venta) =>
        [
          venta.numeroFactura,
          venta.cliente?.nombre,
          venta.lote?.producto?.nombre,
          venta.lote?.numeroFactura,
        ]
          .map(normalizar)
          .some((campo) => campo.includes(busqueda)),
      );
    }

    return items;
  }

  async function listar(filtro: FiltroVentas = {}): Promise<VentaDetalle[]> {
    return aplicarFiltrosDerivados(await ventas.listar(filtro), filtro);
  }

  return {
    listarVentas: listar,

    async obtenerVenta(id) {
      const venta = await ventas.obtener(id);
      if (!venta) throw new ErrorNoEncontrado("la venta", id);
      return venta;
    },

    /**
     * Registrar una venta toca dos tablas y el cliente no tiene transacciones.
     *
     * El orden es deliberado: primero se reserva la existencia con un UPDATE
     * condicional (si otro despacho se adelantó, el UPDATE no afecta filas y
     * abortamos sin haber escrito nada), y solo entonces se inserta la venta.
     * Si el INSERT falla, se devuelve lo reservado.
     *
     * La versión verdaderamente atómica sería una sola transacción en el
     * backend. Mientras no exista, esta secuencia deja el
     * inventario consistente en todos los fallos salvo una caída del cliente
     * justo entre ambas escrituras.
     */
    async registrarVenta(datos) {
      const lote = await lotes.obtener(datos.loteCompraId);
      if (!lote) {
        throw new ErrorNoEncontrado("el lote de compra", datos.loteCompraId);
      }

      const validos = validarNuevaVenta(datos, lote.cantidadDisponible);
      const valorTotal = calcularValorTotal(validos.cantidad, validos.precioUnitario);

      const reservado = await lotes.descontarExistencia(
        lote.id,
        validos.cantidad,
        lote.cantidadDisponible,
      );
      if (!reservado) {
        throw new ErrorConflicto(
          "La existencia del lote cambió mientras registrabas la venta. " +
            "Vuelve a abrir el formulario para ver la cantidad actual.",
        );
      }

      try {
        return await ventas.crear(validos, valorTotal);
      } catch (error) {
        await lotes
          .devolverExistencia(lote.id, validos.cantidad)
          .catch(() => undefined);
        throw error;
      }
    },

    async anularVenta(id) {
      const venta = await ventas.obtener(id);
      if (!venta) throw new ErrorNoEncontrado("la venta", id);

      if (venta.totalCobrado > 0) {
        throw new ErrorConflicto(
          "La venta tiene abonos registrados. Elimina primero los abonos del cliente.",
        );
      }

      await ventas.eliminar(id);
      // La existencia vuelve al lote solo después de que la venta desapareció,
      // para no dejar galones duplicados si el borrado falla.
      await lotes.devolverExistencia(venta.loteCompraId, venta.cantidad);
    },

    listarAbonosDeVenta: (ventaId) => pagos.listarPorVenta(ventaId),

    /**
     * Mismo patrón que la venta: se baja el saldo con UPDATE condicional y
     * después se inserta el abono, compensando si el INSERT falla.
     */
    async registrarAbonoCliente(datos) {
      const venta = await ventas.obtener(datos.ventaId);
      if (!venta) throw new ErrorNoEncontrado("la venta", datos.ventaId);

      const validos = validarAbonoCliente(datos, venta.saldoPendiente);

      const actualizada = await ventas.descontarSaldo(
        venta.id,
        validos.monto,
        venta.saldoPendiente,
      );
      if (!actualizada) {
        throw new ErrorConflicto(
          "El saldo de la venta cambió mientras registrabas el abono. " +
            "Vuelve a abrir el formulario para ver el saldo actual.",
        );
      }

      try {
        return await pagos.crear(validos);
      } catch (error) {
        await ventas.restituirSaldo(venta.id, validos.monto).catch(() => undefined);
        throw error;
      }
    },

    async resumenCobrosPorCliente(filtro = {}) {
      const items = await listar({ ...filtro, soloConSaldo: true });
      return agruparCobrosPorCliente(items);
    },

    /**
     * Mismo razonamiento que `listarMovimientosProveedor`: las ventas y sus
     * abonos se piden sin filtro de fecha para que el saldo de cada fila
     * refleje el historial completo, y el recorte al rango pedido se aplica
     * al final, sobre las filas ya calculadas.
     */
    async listarMovimientosCliente(filtro = {}) {
      const { desde, hasta, ...sinFecha } = filtro;
      const relevantes = await listar(sinFecha);
      const ventaIds = relevantes.map((venta) => venta.id);

      const todosPagos =
        ventaIds.length > 0 ? await pagos.listarEnRango({ ventaIds }) : [];

      const ledger = construirLedgerCliente(relevantes, todosPagos);

      return ledger.filter((fila) => {
        if (desde && fila.fecha < desde) return false;
        if (hasta && fila.fecha > hasta) return false;
        return true;
      });
    },
  };
}
