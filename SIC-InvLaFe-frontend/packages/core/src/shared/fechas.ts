import { CONFIG_REGIONAL } from "./config";
import type { FechaHoraISO, FechaISO } from "./tipos";

/**
 * Fecha de hoy en `YYYY-MM-DD` según la zona horaria del negocio.
 *
 * `toISOString()` convierte a UTC y en Santo Domingo (UTC-4) eso adelanta el
 * día durante toda la tarde/noche: una venta registrada a las 21:00 quedaría
 * fechada al día siguiente. Por eso se formatea con `Intl` en la zona local.
 */
export function hoyISO(): FechaISO {
  return fechaAISO(new Date());
}

export function fechaAISO(fecha: Date): FechaISO {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: CONFIG_REGIONAL.zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
  // `en-CA` ya produce `YYYY-MM-DD`.
  return partes;
}

/** Valida el formato `YYYY-MM-DD` y que la fecha exista realmente. */
export function esFechaISOValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

/** `2026-02-14` → `14/02/26`. Devuelve `—` si la fecha es nula o inválida. */
export function formatearFecha(valor: FechaISO | null | undefined): string {
  if (!valor) return "—";
  const [anio, mes, dia] = valor.slice(0, 10).split("-").map(Number);
  if (!anio || !mes || !dia) return "—";
  // Se construye en UTC y se formatea en UTC para que no haya corrimiento de día.
  return new Intl.DateTimeFormat(CONFIG_REGIONAL.locale, {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

export function formatearFechaHora(valor: FechaHoraISO | null | undefined): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return new Intl.DateTimeFormat(CONFIG_REGIONAL.locale, {
    timeZone: CONFIG_REGIONAL.zonaHoraria,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(fecha);
}

/** Primer día del mes actual, útil para los filtros por defecto de los listados. */
export function inicioDeMesISO(): FechaISO {
  return `${hoyISO().slice(0, 7)}-01`;
}
