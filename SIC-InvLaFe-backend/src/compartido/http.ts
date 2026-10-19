import type { Request } from "express";
import { ErrorAutenticacion, ErrorValidacion } from "./errores.js";
import type { Solicitante } from "../modulos/acceso/servicio.js";

/**
 * Lee un parámetro de la ruta, como el `:id` de `/api/roles/:id`.
 *
 * Express 5 los tipa como `string | string[]`; aquí siempre se espera uno solo.
 */
export function parametroDeRuta(req: Request, nombre: string): string {
  const crudo = req.params[nombre];
  const valor = (Array.isArray(crudo) ? crudo[0] : crudo)?.trim();
  if (!valor) throw new ErrorValidacion(`Falta el parámetro «${nombre}» en la ruta.`);
  return valor;
}

/** Quien hace la petición. Solo existe en rutas con `exigirAutenticacion`. */
export function solicitanteDe(req: Request): Solicitante {
  const solicitante = req.solicitante;
  if (!solicitante) throw new ErrorAutenticacion("No se pudo verificar tu sesión.");
  return solicitante;
}

/** `true` si el texto tiene forma de UUID. Evita consultas con ids imposibles. */
export function esUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}
