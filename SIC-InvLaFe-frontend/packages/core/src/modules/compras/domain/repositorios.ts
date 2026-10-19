import type { ID, RangoFechas } from "../../../shared/tipos";
import type {
  Compra,
  CompraDetalle,
  FiltroCompras,
  FiltroLotes,
  LoteCompraDetalle,
  NuevaCompra,
  NuevoPagoProveedor,
  PagoProveedor,
} from "./entidades";

export interface RepositorioCompras {
  /** Compras con su proveedor, sus líneas y el saldo calculado. */
  listar(filtro?: FiltroCompras): Promise<CompraDetalle[]>;
  obtener(id: ID): Promise<CompraDetalle | null>;
  /**
   * Inserta la cabecera y sus líneas.
   *
   * El navegador no tiene transacciones, así que la implementación compensa:
   * si el detalle falla, borra la cabecera recién creada en vez de dejar una
   * factura sin productos.
   */
  crear(datos: NuevaCompra): Promise<Compra>;
  /** Borra la compra y, en cascada, sus líneas y sus abonos. */
  eliminar(id: ID): Promise<void>;
}

export interface RepositorioLotes {
  /** Líneas de inventario enriquecidas con proveedor y producto. */
  listar(filtro?: FiltroLotes): Promise<LoteCompraDetalle[]>;
  obtener(id: ID): Promise<LoteCompraDetalle | null>;
  /** Solo las líneas con existencia disponible, para el selector de ventas. */
  listarDisponibles(filtro?: FiltroLotes): Promise<LoteCompraDetalle[]>;

  /**
   * Descuenta existencia de la línea de forma condicional.
   *
   * Devuelve `false` si otra escritura cambió la disponibilidad entre la
   * lectura y el descuento. El caso de uso lo traduce en un conflicto para que
   * el usuario reintente con el dato fresco.
   */
  descontarExistencia(
    id: ID,
    cantidad: number,
    disponibleEsperada: number,
  ): Promise<boolean>;

  /** Devuelve existencia. Se usa para compensar una venta fallida o anulada. */
  devolverExistencia(id: ID, cantidad: number): Promise<void>;
}

export interface RepositorioPagosProveedor {
  listarPorCompra(compraId: ID): Promise<PagoProveedor[]>;
  /**
   * Abonos por fecha de pago (no de factura), acotados a un set de facturas.
   *
   * Lo usa el reporte histórico: necesita todos los abonos que cayeron en un
   * rango sin importar cuándo se abrió la factura a la que pertenecen.
   */
  listarEnRango(
    filtro: RangoFechas & { compraIds?: readonly ID[] },
  ): Promise<PagoProveedor[]>;
  crear(datos: NuevoPagoProveedor): Promise<PagoProveedor>;
  eliminar(id: ID): Promise<void>;
}
