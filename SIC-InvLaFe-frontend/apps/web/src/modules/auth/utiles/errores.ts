import { esErrorApp } from "@invlafe/core";

/**
 * Extrae el mapa de errores por campo de un `ErrorValidacion`.
 *
 * Los formularios necesitan saber si el fallo pertenece a un input concreto o
 * si es un error general que va en la alerta de arriba; devolver `{}` para lo
 * segundo permite decidirlo con `Object.keys(...).length`.
 */
export function erroresDeCampo(error: unknown): Record<string, string> {
  if (!esErrorApp(error) || error.codigo !== "VALIDACION") return {};

  const detalle = error.detalle;
  if (!detalle || typeof detalle !== "object") return {};

  return detalle as Record<string, string>;
}
