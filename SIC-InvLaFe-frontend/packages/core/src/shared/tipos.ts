/**
 * Tipos primitivos compartidos por todo el dominio.
 *
 * Los identificadores se modelan como `string` aunque en la base sean `bigint`
 * o `uuid`: los mappers de infraestructura normalizan con `String(...)` al leer,
 * y PostgREST acepta strings al escribir en columnas numéricas. Así el dominio
 * no depende del tipo real de la llave primaria.
 */
export type ID = string;

/** Fecha sin hora, formato `YYYY-MM-DD` (columnas `date`). */
export type FechaISO = string;

/** Marca de tiempo completa (columnas `timestamptz`). */
export type FechaHoraISO = string;

/** Rango de fechas inclusivo usado por los filtros de listado. */
export interface RangoFechas {
  desde?: FechaISO;
  hasta?: FechaISO;
}

/** Página de resultados devuelta por los repositorios que paginan. */
export interface Pagina<T> {
  items: T[];
  total: number;
  pagina: number;
  porPagina: number;
}

/** Parámetros de paginación. `pagina` empieza en 1. */
export interface Paginacion {
  pagina: number;
  porPagina: number;
}

export const PAGINACION_POR_DEFECTO: Paginacion = { pagina: 1, porPagina: 25 };
