import type { ID, RangoFechas } from "../../../shared/tipos";
import type {
  FiltroVentas,
  NuevaVenta,
  NuevoPagoCliente,
  PagoCliente,
  Venta,
  VentaDetalle,
} from "./entidades";

export interface RepositorioVentas {
  listar(filtro?: FiltroVentas): Promise<VentaDetalle[]>;
  obtener(id: ID): Promise<VentaDetalle | null>;
  /** Ventas de un lote, para la trazabilidad del cuadre de galones. */
  listarPorLote(loteCompraId: ID): Promise<VentaDetalle[]>;
  /** Ventas de varios lotes en una sola consulta, para el listado del cuadre. */
  listarPorLotes(loteCompraIds: readonly ID[]): Promise<VentaDetalle[]>;

  /**
   * Inserta la venta. No toca el lote: el descuento de existencia lo coordina
   * el caso de uso `registrarVenta` para poder compensarlo si algo falla.
   */
  crear(datos: NuevaVenta, valorTotal: number): Promise<Venta>;
  eliminar(id: ID): Promise<void>;

  /**
   * Baja el saldo pendiente de forma condicional, igual que el descuento de
   * existencia. Devuelve `null` si el saldo cambió desde la lectura.
   */
  descontarSaldo(
    id: ID,
    monto: number,
    saldoEsperado: number,
  ): Promise<Venta | null>;

  /** Restituye saldo. Compensa un abono que no llegó a persistirse. */
  restituirSaldo(id: ID, monto: number): Promise<void>;
}

export interface RepositorioPagosCliente {
  listarPorVenta(ventaId: ID): Promise<PagoCliente[]>;
  /** Espejo de `RepositorioPagosProveedor.listarEnRango`, para el reporte de cobros. */
  listarEnRango(
    filtro: RangoFechas & { ventaIds?: readonly ID[] },
  ): Promise<PagoCliente[]>;
  crear(datos: NuevoPagoCliente): Promise<PagoCliente>;
  eliminar(id: ID): Promise<void>;
}
