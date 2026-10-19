import { ErrorConflicto, ErrorNoEncontrado } from "../../../shared/errores";
import { normalizar } from "../../../shared/texto";
import type { ID } from "../../../shared/tipos";
import { PRODUCTOS } from "../../catalogos/domain/entidades";
import type { CasosUsoCatalogos } from "../../catalogos/application/casos-uso";
import type {
  Compra,
  CompraDetalle,
  FiltroCompras,
  FilaLedgerProveedor,
  FiltroLotes,
  LoteCompraDetalle,
  NuevaCompra,
  NuevoPagoProveedor,
  PagoProveedor,
} from "../domain/entidades";
import {
  construirLedgerProveedor,
  validarAbonoProveedor,
  validarNuevaCompra,
} from "../domain/entidades";
import type {
  RepositorioCompras,
  RepositorioLotes,
  RepositorioPagosProveedor,
} from "../domain/repositorios";

export interface CasosUsoCompras {
  listarCompras(filtro?: FiltroCompras): Promise<CompraDetalle[]>;
  obtenerCompra(id: ID): Promise<CompraDetalle>;
  registrarCompra(datos: NuevaCompra): Promise<Compra>;
  /**
   * Elimina la compra y, en cascada, sus líneas y sus abonos.
   *
   * Se bloquea si alguna línea ya tiene ventas despachadas: borrar la compra
   * borraría el lote de inventario del que esas ventas siguen dependiendo. La
   * pantalla decide aparte si avisa de los abonos que se perderían; aquí no se
   * bloquea por eso porque, a diferencia de un cliente, el saldo al proveedor
   * se puede seguir reconciliando fuera de la app.
   */
  anularCompra(id: ID): Promise<void>;

  /** Líneas de inventario sueltas: alimentan el cuadre. */
  listarLotes(filtro?: FiltroLotes): Promise<LoteCompraDetalle[]>;
  /** Solo las que tienen existencia: alimentan el selector de ventas. */
  listarLotesDisponibles(filtro?: FiltroLotes): Promise<LoteCompraDetalle[]>;
  obtenerLote(id: ID): Promise<LoteCompraDetalle>;

  listarAbonos(compraId: ID): Promise<PagoProveedor[]>;
  registrarAbono(datos: NuevoPagoProveedor): Promise<PagoProveedor>;
  eliminarAbono(id: ID): Promise<void>;

  /**
   * Ledger histórico para el reporte: cada factura del filtro con cada uno de
   * sus abonos como fila propia, recortado al rango de fechas pedido.
   */
  listarMovimientosProveedor(filtro?: FiltroCompras): Promise<FilaLedgerProveedor[]>;
}

export function crearCasosUsoCompras(deps: {
  compras: RepositorioCompras;
  lotes: RepositorioLotes;
  pagos: RepositorioPagosProveedor;
  catalogos: CasosUsoCatalogos;
}): CasosUsoCompras {
  const { compras, lotes, pagos, catalogos } = deps;

  /**
   * Traduce `soloProducto` (clave de negocio) a los ids reales del catálogo.
   * Si el catálogo no tiene aceite dado de alta, se devuelve `[]`, lo que
   * produce cero resultados: preferible a mostrar todo.
   */
  async function resolverProductoIds(filtro: {
    productoIds?: ID[];
    soloProducto?: "aceite" | "combustible";
  }): Promise<ID[] | undefined> {
    if (filtro.productoIds?.length) return filtro.productoIds;
    if (!filtro.soloProducto) return undefined;

    return filtro.soloProducto === "aceite"
      ? catalogos.idsDeProducto(PRODUCTOS.ACEITE)
      : catalogos.idsDeCombustible();
  }

  async function listarLineas(
    filtro: FiltroLotes = {},
    soloDisponibles: boolean,
  ): Promise<LoteCompraDetalle[]> {
    const productoIds = await resolverProductoIds(filtro);
    // `soloProducto` ya quedó resuelto en `productoIds`; se descarta para que
    // el repositorio no tenga que conocer claves de negocio.
    const { soloProducto: _, busqueda, ...resto } = filtro;

    const consulta: FiltroLotes = { ...resto, soloDisponibles };
    if (productoIds) consulta.productoIds = productoIds;

    const resultado = soloDisponibles
      ? await lotes.listarDisponibles(consulta)
      : await lotes.listar(consulta);

    const texto = normalizar(busqueda);
    const items = texto
      ? resultado.filter((linea) =>
          [linea.numeroFactura, linea.proveedor?.nombre, linea.producto?.nombre]
            .map(normalizar)
            .some((campo) => campo.includes(texto)),
        )
      : resultado;

    // La consulta ordena por `creado_en` porque PostgREST no ordena el nivel
    // superior por una columna de la cabecera. Aquí sí se puede.
    return [...items].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  const casosUso: CasosUsoCompras = {
    /**
     * El filtro por producto se aplica aquí y no en la consulta a propósito.
     *
     * Filtrarlo en Postgres exigiría un `inner join` sobre las líneas, y eso
     * devolvería la factura recortada a los productos buscados: en «Control de
     * aceite» verías una compra de aceite sin el diésel que venía en el mismo
     * camión, y el importe de la cabecera no cuadraría con lo que se muestra.
     * Aquí la factura se conserva entera y solo se decide si entra o no.
     */
    async listarCompras(filtro = {}) {
      let items = await compras.listar(filtro);

      const productoIds = await resolverProductoIds(filtro);
      if (productoIds) {
        const buscados = new Set(productoIds);
        items = items.filter((compra) =>
          compra.lineas.some((linea) => buscados.has(linea.productoId)),
        );
      }

      if (filtro.productoId) {
        items = items.filter((compra) =>
          compra.lineas.some((linea) => linea.productoId === filtro.productoId),
        );
      }

      if (filtro.estadoPago) {
        items = items.filter((compra) => compra.estadoPago === filtro.estadoPago);
      }

      const busqueda = normalizar(filtro.busqueda);
      if (busqueda) {
        items = items.filter((compra) =>
          [
            compra.numeroFactura,
            compra.proveedor?.nombre,
            ...compra.lineas.map((linea) => linea.producto?.nombre),
          ]
            .map(normalizar)
            .some((campo) => campo.includes(busqueda)),
        );
      }

      return items;
    },

    async obtenerCompra(id) {
      const compra = await compras.obtener(id);
      if (!compra) throw new ErrorNoEncontrado("la compra", id);
      return compra;
    },

    registrarCompra(datos) {
      return compras.crear(validarNuevaCompra(datos));
    },

    async anularCompra(id) {
      const compra = await compras.obtener(id);
      if (!compra) throw new ErrorNoEncontrado("la compra", id);

      const conVentas = compra.lineas.some((linea) => linea.cantidadDespachada > 0);
      if (conVentas) {
        throw new ErrorConflicto(
          "La compra tiene ventas despachadas de sus lotes. Anula esas ventas antes de anular la compra.",
        );
      }

      await compras.eliminar(id);
    },

    listarLotes: (filtro) => listarLineas(filtro, false),
    listarLotesDisponibles: (filtro) => listarLineas(filtro, true),

    async obtenerLote(id) {
      const lote = await lotes.obtener(id);
      if (!lote) throw new ErrorNoEncontrado("el lote de compra", id);
      return lote;
    },

    listarAbonos: (compraId) => pagos.listarPorCompra(compraId),

    /**
     * El saldo se relee antes de validar en lugar de confiar en el que trae la
     * pantalla: entre que se abrió el modal y se pulsó guardar, otro usuario
     * pudo haber abonado.
     */
    async registrarAbono(datos) {
      const compra = await compras.obtener(datos.compraId);
      if (!compra) throw new ErrorNoEncontrado("la compra", datos.compraId);

      const validos = validarAbonoProveedor(datos, compra.saldoPendiente);
      return pagos.crear(validos);
    },

    eliminarAbono: (id) => pagos.eliminar(id),

    /**
     * El saldo de cada fila de abono debe reflejar el historial completo de la
     * factura, no solo lo que cayó dentro del rango; por eso las facturas y
     * los abonos se piden sin filtro de fecha y el recorte al rango se aplica
     * al final, sobre las filas ya calculadas.
     */
    async listarMovimientosProveedor(filtro = {}) {
      const { desde, hasta, ...sinFecha } = filtro;
      const relevantes = await casosUso.listarCompras(sinFecha);
      const compraIds = relevantes.map((compra) => compra.id);

      const todosPagos =
        compraIds.length > 0 ? await pagos.listarEnRango({ compraIds }) : [];

      const ledger = construirLedgerProveedor(relevantes, todosPagos);

      return ledger.filter((fila) => {
        if (desde && fila.fecha < desde) return false;
        if (hasta && fila.fecha > hasta) return false;
        return true;
      });
    },
  };

  return casosUso;
}
