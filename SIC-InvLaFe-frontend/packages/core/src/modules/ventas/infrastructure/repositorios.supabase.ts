import type { ClienteSupabase } from "../../../infrastructure/supabase/cliente";
import {
  ejecutar,
  ejecutarOpcional,
  ejecutarSinRetorno,
} from "../../../infrastructure/supabase/errores";
import {
  TABLAS,
  aFecha,
  aId,
  aNumero,
  type FilaCliente,
  type FilaPagoCliente,
  type FilaVenta,
} from "../../../infrastructure/supabase/tablas";
import { redondearMonto } from "../../../shared/numeros";
import type { ID } from "../../../shared/tipos";
import {
  aLoteDetalleDesdeLinea,
  type FilaLoteExpandida,
} from "../../compras/infrastructure/repositorios.supabase";
import type {
  FiltroVentas,
  NuevaVenta,
  NuevoPagoCliente,
  PagoCliente,
  Venta,
  VentaDetalle,
} from "../domain/entidades";
import {
  LIMITE_VENTAS_POR_DEFECTO,
  estadoDeCobro,
  totalCobrado,
} from "../domain/entidades";
import type {
  RepositorioPagosCliente,
  RepositorioVentas,
} from "../domain/repositorios";

/**
 * El lote se trae anidado con su producto y su factura de compra para que la
 * pantalla de ventas pueda mostrar de qué compra salió cada despacho sin
 * consultas adicionales.
 */
const SELECT_VENTA = `
  *,
  cliente:${TABLAS.CLIENTES}(*),
  lote:${TABLAS.LOTES_COMPRA}(
    *,
    producto:${TABLAS.PRODUCTOS}(*),
    compra:${TABLAS.COMPRAS}(*, proveedor:${TABLAS.PROVEEDORES}(*))
  )
` as const;

interface FilaVentaExpandida extends FilaVenta {
  cliente: FilaCliente | null;
  lote: FilaLoteExpandida | null;
}

function aVenta(fila: FilaVenta): Venta {
  return {
    id: aId(fila.id),
    loteCompraId: aId(fila.lote_compra_id),
    clienteId: aId(fila.cliente_id),
    fecha: aFecha(fila.fecha),
    numeroFactura: fila.numero_factura,
    cantidad: aNumero(fila.cantidad),
    precioUnitario: aNumero(fila.precio_unitario),
    valorTotal: aNumero(fila.valor_total),
    saldoPendiente: aNumero(fila.saldo_pendiente),
    detalle: fila.detalle,
    creadoEn: fila.creado_en,
  };
}

function aVentaDetalle(fila: FilaVentaExpandida): VentaDetalle {
  const venta = aVenta(fila);

  return {
    ...venta,
    cliente: fila.cliente
      ? {
          id: aId(fila.cliente.id),
          nombre: fila.cliente.nombre,
          telefono: fila.cliente.telefono,
          creadoEn: fila.cliente.creado_en,
        }
      : null,
    lote: fila.lote ? aLoteDetalleDesdeLinea(fila.lote) : null,
    totalCobrado: totalCobrado(venta),
    estadoCobro: estadoDeCobro(venta.valorTotal, venta.saldoPendiente),
  };
}

const aPagoCliente = (fila: FilaPagoCliente): PagoCliente => ({
  id: aId(fila.id),
  ventaId: aId(fila.venta_id),
  fecha: aFecha(fila.fecha),
  monto: aNumero(fila.monto),
  creadoEn: fila.creado_en,
});

export function crearRepositorioVentas(cliente: ClienteSupabase): RepositorioVentas {
  const tabla = () => cliente.from(TABLAS.VENTAS);

  function consultar(filtro: FiltroVentas = {}) {
    let consulta = tabla().select(SELECT_VENTA);

    if (filtro.desde) consulta = consulta.gte("fecha", filtro.desde);
    if (filtro.hasta) consulta = consulta.lte("fecha", filtro.hasta);
    if (filtro.clienteId) consulta = consulta.eq("cliente_id", filtro.clienteId);
    if (filtro.loteCompraId) {
      consulta = consulta.eq("lote_compra_id", filtro.loteCompraId);
    }
    if (filtro.soloConSaldo) consulta = consulta.gt("saldo_pendiente", 0);

    return consulta
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(filtro.limite ?? LIMITE_VENTAS_POR_DEFECTO);
  }

  return {
    async listar(filtro) {
      const filas = await ejecutar<FilaVentaExpandida[]>(
        consultar(filtro),
        "cargar las ventas",
      );
      return filas.map(aVentaDetalle);
    },

    async listarPorLote(loteCompraId: ID) {
      const filas = await ejecutar<FilaVentaExpandida[]>(
        tabla()
          .select(SELECT_VENTA)
          .eq("lote_compra_id", loteCompraId)
          .order("fecha", { ascending: true })
          .order("creado_en", { ascending: true }),
        "cargar las ventas del lote",
      );
      return filas.map(aVentaDetalle);
    },

    async listarPorLotes(loteCompraIds: readonly ID[]) {
      if (loteCompraIds.length === 0) return [];

      const filas = await ejecutar<FilaVentaExpandida[]>(
        tabla()
          .select(SELECT_VENTA)
          .in("lote_compra_id", [...loteCompraIds])
          .order("fecha", { ascending: true })
          .order("creado_en", { ascending: true }),
        "cargar las ventas de los lotes",
      );
      return filas.map(aVentaDetalle);
    },

    async obtener(id: ID) {
      const fila = await ejecutarOpcional<FilaVentaExpandida>(
        tabla().select(SELECT_VENTA).eq("id", id).single(),
        "cargar la venta",
      );
      return fila ? aVentaDetalle(fila) : null;
    },

    async crear(datos: NuevaVenta, valorTotal: number) {
      const fila = await ejecutar<FilaVenta>(
        tabla()
          .insert({
            lote_compra_id: datos.loteCompraId,
            cliente_id: datos.clienteId,
            fecha: datos.fecha,
            numero_factura: datos.numeroFactura,
            cantidad: datos.cantidad,
            precio_unitario: datos.precioUnitario,
            valor_total: valorTotal,
            // El cliente arranca debiendo la venta completa; los abonos la bajan.
            saldo_pendiente: valorTotal,
            detalle: datos.detalle ?? null,
          })
          .select("*")
          .single(),
        "registrar la venta",
      );
      return aVenta(fila);
    },

    async eliminar(id: ID) {
      await ejecutarSinRetorno(tabla().delete().eq("id", id), "eliminar la venta");
    },

    /** Mismo bloqueo optimista que el descuento de existencia del lote. */
    async descontarSaldo(id, monto, saldoEsperado) {
      const filas = await ejecutar<FilaVenta[]>(
        tabla()
          .update({ saldo_pendiente: redondearMonto(saldoEsperado - monto) })
          .eq("id", id)
          .eq("saldo_pendiente", saldoEsperado)
          .select("*"),
        "actualizar el saldo de la venta",
      );
      const fila = filas[0];
      return fila ? aVenta(fila) : null;
    },

    async restituirSaldo(id, monto) {
      const actual = await ejecutarOpcional<FilaVenta>(
        tabla().select("*").eq("id", id).single(),
        "leer la venta para restituir el saldo",
      );
      if (!actual) return;

      await ejecutarSinRetorno(
        tabla()
          .update({
            saldo_pendiente: redondearMonto(aNumero(actual.saldo_pendiente) + monto),
          })
          .eq("id", id),
        "restituir el saldo de la venta",
      );
    },
  };
}

export function crearRepositorioPagosCliente(
  cliente: ClienteSupabase,
): RepositorioPagosCliente {
  const tabla = () => cliente.from(TABLAS.PAGOS_CLIENTE);

  return {
    async listarPorVenta(ventaId: ID) {
      const filas = await ejecutar<FilaPagoCliente[]>(
        tabla()
          .select("*")
          .eq("venta_id", ventaId)
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false }),
        "cargar los abonos de la venta",
      );
      return filas.map(aPagoCliente);
    },

    async listarEnRango(filtro) {
      // Sin ventas que calcen el filtro, ni vale la pena ir a la base: no
      // habría ningún `venta_id` que pedir.
      if (filtro.ventaIds && filtro.ventaIds.length === 0) return [];

      let consulta = tabla().select("*");
      if (filtro.desde) consulta = consulta.gte("fecha", filtro.desde);
      if (filtro.hasta) consulta = consulta.lte("fecha", filtro.hasta);
      if (filtro.ventaIds) consulta = consulta.in("venta_id", filtro.ventaIds);

      const filas = await ejecutar<FilaPagoCliente[]>(
        consulta.order("fecha", { ascending: true }).order("creado_en", { ascending: true }),
        "cargar los abonos del periodo",
      );
      return filas.map(aPagoCliente);
    },

    async crear(datos: NuevoPagoCliente) {
      const fila = await ejecutar<FilaPagoCliente>(
        tabla()
          .insert({
            venta_id: datos.ventaId,
            fecha: datos.fecha,
            monto: datos.monto,
          })
          .select("*")
          .single(),
        "registrar el abono del cliente",
      );
      return aPagoCliente(fila);
    },

    async eliminar(id: ID) {
      await ejecutarSinRetorno(tabla().delete().eq("id", id), "eliminar el abono");
    },
  };
}
