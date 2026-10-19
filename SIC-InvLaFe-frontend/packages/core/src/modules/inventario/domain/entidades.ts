import { redondearCantidad, redondearMonto } from "../../../shared/numeros";
import type {
  LoteCompraDetalle,
} from "../../compras/domain/entidades";
import type { VentaDetalle } from "../../ventas/domain/entidades";

/**
 * Trazabilidad de un lote: la entrada (compra) con sus salidas (ventas) debajo.
 *
 * No hay tabla nueva detrás: se compone de `lotes_compra` + `ventas`.
 */
export interface CuadreLote {
  lote: LoteCompraDetalle;
  ventas: VentaDetalle[];
  /** Suma de las cantidades vendidas del lote. */
  totalVendido: number;
  /** Suma del valor de esas ventas. */
  totalFacturado: number;
  /** Lo que aún queda físicamente, según la propia columna del lote. */
  disponible: number;
  /**
   * `comprado - vendido - disponible`. Debería ser 0; cualquier otro valor
   * significa que el lote se movió por fuera del registro de ventas.
   */
  diferencia: number;
  cuadra: boolean;
}

/** Totales de la pantalla de cuadre, sobre los lotes ya filtrados. */
export interface ResumenCuadre {
  lotes: number;
  totalComprado: number;
  totalVendido: number;
  totalDisponible: number;
  lotesDescuadrados: number;
}

/** Tolerancia del cuadre: medio centésimo de galón es ruido de redondeo. */
const TOLERANCIA_GALONES = 0.005;

export function construirCuadre(
  lote: LoteCompraDetalle,
  ventas: readonly VentaDetalle[],
): CuadreLote {
  const totalVendido = redondearCantidad(
    ventas.reduce((total, venta) => total + venta.cantidad, 0),
  );
  const totalFacturado = redondearMonto(
    ventas.reduce((total, venta) => total + venta.valorTotal, 0),
  );
  const diferencia = redondearCantidad(
    lote.cantidadComprada - totalVendido - lote.cantidadDisponible,
  );

  return {
    lote,
    ventas: [...ventas],
    totalVendido,
    totalFacturado,
    disponible: lote.cantidadDisponible,
    diferencia,
    cuadra: Math.abs(diferencia) <= TOLERANCIA_GALONES,
  };
}

export function resumirCuadre(cuadres: readonly CuadreLote[]): ResumenCuadre {
  return {
    lotes: cuadres.length,
    totalComprado: redondearCantidad(
      cuadres.reduce((total, cuadre) => total + cuadre.lote.cantidadComprada, 0),
    ),
    totalVendido: redondearCantidad(
      cuadres.reduce((total, cuadre) => total + cuadre.totalVendido, 0),
    ),
    totalDisponible: redondearCantidad(
      cuadres.reduce((total, cuadre) => total + cuadre.disponible, 0),
    ),
    lotesDescuadrados: cuadres.filter((cuadre) => !cuadre.cuadra).length,
  };
}
