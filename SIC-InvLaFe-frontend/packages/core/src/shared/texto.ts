/**
 * Normaliza texto para comparaciones tolerantes: minúsculas, sin acentos y sin
 * signos. `"Pago a Proveedor"` y `"pagos_proveedor"` colapsan al mismo valor.
 *
 * Se usa para casar los nombres libres de la tabla `modulos` y `productos` con
 * las constantes del frontend, que no controlamos desde aquí.
 */
export function normalizar(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas de acento sueltas tras NFD
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Convierte `""` y strings de solo espacios en `null`, para columnas opcionales. */
export function textoONulo(valor: string | null | undefined): string | null {
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

/** Iniciales para el avatar del usuario: `"Juan Pérez"` → `"JP"`. */
export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return "?";
  const palabras = nombre.trim().split(/\s+/).slice(0, 2);
  return palabras.map((palabra) => palabra.charAt(0).toUpperCase()).join("") || "?";
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function esCorreoValido(valor: string): boolean {
  return EMAIL.test(valor.trim());
}

/**
 * Nombre de usuario: de 3 a 30 caracteres, empieza por letra o número y admite
 * punto, guion y guion bajo.
 *
 * Lo decisivo es que **no puede contener arroba**: es lo que permite saber, en
 * el login, si lo escrito es un correo o un nombre de usuario. Debe coincidir
 * con `PATRON_NOMBRE_USUARIO` del backend y con la restricción
 * `usuarios_usuario_formato` de la base.
 */
const NOMBRE_USUARIO = /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/;

export function esNombreUsuarioValido(valor: string): boolean {
  return NOMBRE_USUARIO.test(valor.trim());
}

/**
 * Decide si lo escrito en el login es un correo o un nombre de usuario.
 *
 * La arroba es el único criterio, y basta porque los nombres de usuario la
 * tienen prohibida. Si el texto la lleva pero está mal formado, se trata como
 * correo de todos modos: así el mensaje de error habla del correo en vez de
 * decir que no existe ese nombre de usuario.
 */
export function pareceCorreo(valor: string): boolean {
  return valor.includes("@");
}
