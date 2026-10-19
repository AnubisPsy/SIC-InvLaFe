import type { FechaISO } from "@invlafe/core";

/**
 * Cómo se formatea/tipa una columna en cada salida.
 *
 * El mismo dato crudo se usa para PDF (texto formateado) y Excel (valor
 * nativo: `Date` real, número real), para que en Excel se pueda filtrar y
 * sumar la columna en vez de recibir puro texto ya maquillado.
 */
export type TipoColumnaReporte = "texto" | "fecha" | "cantidad" | "moneda";

export interface ColumnaReporte {
  encabezado: string;
  tipo: TipoColumnaReporte;
  /** Alineación en el PDF; en Excel se decide sola según el tipo. */
  alineacion?: "left" | "right" | "center";
}

/** Celda cruda: `Date` en columnas de fecha, `number` en cantidad/moneda, `null` para vacío. */
export type CeldaReporte = string | number | Date | null;

export interface ReporteExportable {
  /** Título de la pestaña, p. ej. "Pago a proveedor". */
  titulo: string;
  desde: FechaISO;
  hasta: FechaISO;
  columnas: ColumnaReporte[];
  filas: CeldaReporte[][];
  /** Fila de totales opcional, mismas reglas de tipo que `columnas`. */
  totales?: CeldaReporte[];
  /** Base del nombre de archivo, sin fechas ni extensión, p. ej. "pago-proveedor". */
  slug: string;
}

/** `"YYYY-MM-DD"` a `Date` a mediodía local, para que ningún huso corra la fecha un día. */
export function fechaISOaDate(iso: string): Date {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, (mes ?? 1) - 1, dia ?? 1, 12);
}

export function nombreArchivoReporte(reporte: Pick<ReporteExportable, "slug" | "desde" | "hasta">): string {
  return `reporte-${reporte.slug}-${reporte.desde}_${reporte.hasta}`;
}
