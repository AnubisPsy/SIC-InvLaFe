import { CONFIG_REGIONAL } from "./config";

export const DECIMALES_MONTO = 2;
export const DECIMALES_CANTIDAD = 2;

/**
 * Redondeo half-away-from-zero estable.
 *
 * `Math.round` sobre flotantes arrastra el error de representación binaria
 * (`Math.round(1.005 * 100) === 100`), lo que en una columna de dinero produce
 * saldos que no cierran. El `Number(...)+"e"` fuerza el redondeo decimal.
 */
export function redondear(valor: number, decimales: number): number {
  if (!Number.isFinite(valor)) return 0;
  const factor = `e${decimales}`;
  const factorInverso = `e-${decimales}`;
  return Number(`${Math.round(Number(`${valor}${factor}`))}${factorInverso}`);
}

export const redondearMonto = (valor: number): number =>
  redondear(valor, DECIMALES_MONTO);

export const redondearCantidad = (valor: number): number =>
  redondear(valor, DECIMALES_CANTIDAD);

/** Suma una lista de montos redondeando solo al final, para no acumular error. */
export function sumarMontos(montos: readonly number[]): number {
  return redondearMonto(montos.reduce((total, monto) => total + monto, 0));
}

/**
 * Comparación tolerante para dinero. Dos montos que difieren en menos de medio
 * centavo son el mismo monto: evita que un saldo de `0.0000001` se muestre como
 * pendiente.
 */
export function montosIguales(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

export function esCero(monto: number): boolean {
  return montosIguales(monto, 0);
}

/** Convierte texto de un input a número, aceptando coma decimal y separadores. */
export function parsearNumero(entrada: string | number | null | undefined): number | null {
  if (typeof entrada === "number") return Number.isFinite(entrada) ? entrada : null;
  if (entrada === null || entrada === undefined) return null;

  const limpio = entrada.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (limpio === "") return null;

  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}

export function formatearMonto(valor: number): string {
  return new Intl.NumberFormat(CONFIG_REGIONAL.locale, {
    style: "currency",
    currency: CONFIG_REGIONAL.moneda,
    minimumFractionDigits: DECIMALES_MONTO,
    maximumFractionDigits: DECIMALES_MONTO,
  }).format(redondearMonto(valor));
}

export function formatearCantidad(valor: number): string {
  const numero = new Intl.NumberFormat(CONFIG_REGIONAL.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: DECIMALES_CANTIDAD,
  }).format(redondearCantidad(valor));
  return `${numero} ${CONFIG_REGIONAL.unidadCantidad}`;
}
