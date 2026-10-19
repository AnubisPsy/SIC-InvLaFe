import type { Request } from "express";
import { ErrorValidacion } from "./errores.js";
import { esObjetoPlano } from "./validacion.js";

/**
 * Lectura de filtros (`?desde=...&hasta=...`) y validación de cuerpos con
 * números y fechas. Los usan compras, ventas, cobros y cotizaciones.
 */

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Texto de un filtro de la URL, o `undefined` si no vino. */
export function filtroTexto(req: Request, nombre: string): string | undefined {
  const valor = req.query[nombre];
  const texto = (Array.isArray(valor) ? valor[0] : valor)?.toString().trim();
  return texto ? texto : undefined;
}

/** Fecha `YYYY-MM-DD` de un filtro de la URL. */
export function filtroFecha(req: Request, nombre: string): string | undefined {
  const texto = filtroTexto(req, nombre);
  if (texto !== undefined && !PATRON_FECHA.test(texto)) {
    throw new ErrorValidacion(`El filtro «${nombre}» debe tener el formato AAAA-MM-DD.`);
  }
  return texto;
}

/** Lista separada por comas: `?productoIds=a,b,c`. */
export function filtroLista(req: Request, nombre: string): string[] | undefined {
  const texto = filtroTexto(req, nombre);
  if (texto === undefined) return undefined;
  return texto.split(",").map((parte) => parte.trim()).filter(Boolean);
}

export function filtroBooleano(req: Request, nombre: string): boolean {
  return filtroTexto(req, nombre) === "true";
}

/** Número entero positivo con tope, para `?limite=`. */
export function filtroLimite(req: Request, porDefecto: number, maximo = 5000): number {
  const texto = filtroTexto(req, "limite");
  if (texto === undefined) return porDefecto;
  const numero = Number(texto);
  if (!Number.isInteger(numero) || numero < 1) {
    throw new ErrorValidacion("El filtro «limite» debe ser un número entero positivo.");
  }
  return Math.min(numero, maximo);
}

// --- Cuerpos JSON --------------------------------------------------------------

export function cuerpoObjeto(cuerpo: unknown): Record<string, unknown> {
  if (!esObjetoPlano(cuerpo)) {
    throw new ErrorValidacion("El cuerpo de la petición debe ser un objeto JSON.");
  }
  return cuerpo;
}

/** Texto obligatorio. */
export function campoTexto(datos: Record<string, unknown>, nombre: string): string {
  const valor = typeof datos[nombre] === "string" ? (datos[nombre] as string).trim() : "";
  if (!valor) throw new ErrorValidacion(`Falta el campo «${nombre}».`, { [nombre]: "Obligatorio." });
  return valor;
}

/** Texto opcional: `null` si viene vacío o no viene. */
export function campoTextoOpcional(datos: Record<string, unknown>, nombre: string): string | null {
  const valor = datos[nombre];
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") {
    throw new ErrorValidacion(`El campo «${nombre}» debe ser texto.`, { [nombre]: "Debe ser texto." });
  }
  return valor.trim() || null;
}

export function campoFecha(datos: Record<string, unknown>, nombre: string): string {
  const valor = campoTexto(datos, nombre);
  if (!PATRON_FECHA.test(valor)) {
    throw new ErrorValidacion(`El campo «${nombre}» debe tener el formato AAAA-MM-DD.`, {
      [nombre]: "Usa el formato AAAA-MM-DD.",
    });
  }
  return valor;
}

/** Número finito. `minimo` es inclusivo; con `estricto`, debe ser mayor. */
export function campoNumero(
  datos: Record<string, unknown>,
  nombre: string,
  { minimo = 0, estricto = false }: { minimo?: number; estricto?: boolean } = {},
): number {
  const valor = datos[nombre];
  const numero = typeof valor === "number" ? valor : Number.NaN;
  const valido = Number.isFinite(numero) && (estricto ? numero > minimo : numero >= minimo);
  if (!valido) {
    const condicion = estricto ? `mayor que ${minimo}` : `mayor o igual a ${minimo}`;
    throw new ErrorValidacion(`El campo «${nombre}» debe ser un número ${condicion}.`, {
      [nombre]: `Debe ser un número ${condicion}.`,
    });
  }
  return numero;
}

/** Redondeo a 2 decimales, igual que `redondearCantidad` y `redondearMonto` del frontend. */
export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
