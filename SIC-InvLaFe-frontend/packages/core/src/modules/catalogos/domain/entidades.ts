import { normalizar, textoONulo } from "../../../shared/texto";
import { ErrorValidacion } from "../../../shared/errores";
import type { FechaHoraISO, ID } from "../../../shared/tipos";

export interface Proveedor {
  id: ID;
  nombre: string;
  telefono: string | null;
  creadoEn: FechaHoraISO;
}

export interface Cliente {
  id: ID;
  nombre: string;
  telefono: string | null;
  creadoEn: FechaHoraISO;
}

export interface Producto {
  id: ID;
  nombre: string;
}

/**
 * Productos que maneja el negocio. Los valores son la forma normalizada del
 * `productos.nombre` guardado en la base, no el id: el id lo asigna Postgres y
 * cambia entre entornos.
 */
export const PRODUCTOS = {
  REGULAR: "regular",
  DIESEL: "diesel",
  KERO: "kero",
  ACEITE: "aceite",
} as const;

export type ClaveProducto = (typeof PRODUCTOS)[keyof typeof PRODUCTOS];

/**
 * Alias aceptados para cada producto. "Aceite" y "lubricante" son el mismo
 * producto para el negocio, y el nombre en base puede venir escrito de varias
 * formas ("Gasolina Regular", "Diésel", "Kerosene").
 */
const ALIAS_PRODUCTO: Record<ClaveProducto, readonly string[]> = {
  [PRODUCTOS.REGULAR]: ["regular", "gasolina", "gasolina_regular"],
  [PRODUCTOS.DIESEL]: ["diesel", "gasoil", "gas_oil"],
  [PRODUCTOS.KERO]: ["kero", "kerosene", "kerosen", "keroseno"],
  [PRODUCTOS.ACEITE]: ["aceite", "lubricante", "aceites", "lubricantes"],
};

/** Deduce la clave de negocio a partir del nombre libre guardado en la base. */
export function claveDeProducto(producto: Producto | null | undefined): ClaveProducto | null {
  const nombre = normalizar(producto?.nombre);
  if (!nombre) return null;

  for (const [clave, alias] of Object.entries(ALIAS_PRODUCTO) as [
    ClaveProducto,
    readonly string[],
  ][]) {
    if (alias.some((valor) => nombre === valor || nombre.includes(valor))) {
      return clave;
    }
  }
  return null;
}

/** El módulo "Control de aceite" filtra por esto. */
export function esAceite(producto: Producto | null | undefined): boolean {
  return claveDeProducto(producto) === PRODUCTOS.ACEITE;
}

export function esCombustible(producto: Producto | null | undefined): boolean {
  const clave = claveDeProducto(producto);
  return clave !== null && clave !== PRODUCTOS.ACEITE;
}

// --- Entradas de escritura y sus reglas -------------------------------------

export interface DatosContacto {
  nombre: string;
  telefono: string | null;
}

export interface DatosProducto {
  nombre: string;
}

interface ContactoNormalizado {
  nombre: string;
  telefono: string | null;
}

/**
 * Valida y limpia los datos comunes de proveedor y cliente. Ambos son la misma
 * forma (nombre + teléfono opcional), así que comparten la regla.
 */
export function validarContacto(
  datos: DatosContacto,
  etiqueta: "proveedor" | "cliente",
): ContactoNormalizado {
  const campos: Record<string, string> = {};

  const nombre = datos.nombre?.trim() ?? "";
  if (nombre.length < 2) {
    campos.nombre = "El nombre debe tener al menos 2 caracteres.";
  } else if (nombre.length > 120) {
    campos.nombre = "El nombre no puede pasar de 120 caracteres.";
  }

  const telefono = textoONulo(datos.telefono);
  if (telefono && !/^[\d\s()+-]{7,25}$/.test(telefono)) {
    campos.telefono = "El teléfono solo admite números, espacios y los signos + ( ) -.";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion(`Revisa los datos del ${etiqueta}.`, campos);
  }

  return { nombre, telefono };
}

/** Mismas reglas de nombre que `validarContacto`, sin el teléfono. */
export function validarProducto(datos: DatosProducto): { nombre: string } {
  const campos: Record<string, string> = {};

  const nombre = datos.nombre?.trim() ?? "";
  if (nombre.length < 2) {
    campos.nombre = "El nombre debe tener al menos 2 caracteres.";
  } else if (nombre.length > 120) {
    campos.nombre = "El nombre no puede pasar de 120 caracteres.";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion("Revisa los datos del producto.", campos);
  }

  return { nombre };
}
