import type { ID } from "../../../shared/tipos";
import type {
  Cotizacion,
  CotizacionDetalle,
  DatosCotizacion,
  EstadoCotizacion,
  FiltroCotizaciones,
} from "./entidades";

export interface RepositorioCotizaciones {
  listar(filtro?: FiltroCotizaciones): Promise<CotizacionDetalle[]>;
  obtener(id: ID): Promise<CotizacionDetalle | null>;
  /**
   * Inserta la cotización y sus líneas, compensando si el detalle falla: una
   * cotización sin productos no significa nada y es mejor no dejarla.
   */
  crear(datos: DatosCotizacion): Promise<Cotizacion>;
  /** Reemplaza la cotización y todas sus líneas. */
  actualizar(id: ID, datos: DatosCotizacion): Promise<Cotizacion>;
  cambiarEstado(id: ID, estado: EstadoCotizacion): Promise<Cotizacion>;
  /** Marca la cotización como facturada, apuntando a la primera venta. */
  enlazarVenta(id: ID, ventaId: ID): Promise<Cotizacion>;
  /** Enlaza una línea concreta con la venta que salió de ella. */
  enlazarVentaDeLinea(lineaId: ID, ventaId: ID): Promise<void>;
  eliminar(id: ID): Promise<void>;
}
