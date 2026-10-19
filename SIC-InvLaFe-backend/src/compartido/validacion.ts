/**
 * Validación de payloads sin dependencias externas.
 *
 * Para cuatro endpoints, una librería de esquemas añadiría más superficie de
 * mantenimiento que la que ahorra. Las reglas replican deliberadamente las del
 * dominio del frontend (`validarUsuario`), porque la validación del navegador
 * es una comodidad, no una garantía: quien llama a la API puede saltársela.
 */
import { ErrorValidacion } from "./errores.js";

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PATRON_TELEFONO = /^[\d\s()+-]{7,25}$/;

/**
 * Nombre de usuario: de 3 a 30 caracteres, empieza por letra o número y admite
 * punto, guion y guion bajo.
 *
 * Lo que de verdad importa es que **no puede contener arroba**: es lo que
 * permite distinguir en el login un correo de un nombre de usuario mirando solo
 * el texto. Debe coincidir con `PATRON_NOMBRE_USUARIO` del frontend y con la
 * restricción `usuarios_usuario_formato` de la base.
 */
const PATRON_NOMBRE_USUARIO = /^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$/;

/** Acumula errores por campo para devolverlos todos juntos, no de uno en uno. */
export class Validador {
  private readonly campos: Record<string, string> = {};

  agregar(campo: string, mensaje: string): void {
    // El primer error de cada campo es el más específico; no lo pisamos.
    this.campos[campo] ??= mensaje;
  }

  get tieneErrores(): boolean {
    return Object.keys(this.campos).length > 0;
  }

  lanzarSiFalla(mensaje: string): void {
    if (this.tieneErrores) throw new ErrorValidacion(mensaje, this.campos);
  }
}

export function esObjetoPlano(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/** Texto recortado, o `null` si venía vacío o no era texto. */
export function textoONulo(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : null;
}

export function esCorreoValido(correo: string): boolean {
  return PATRON_CORREO.test(correo);
}

export function esTelefonoValido(telefono: string): boolean {
  return PATRON_TELEFONO.test(telefono);
}

export function esNombreUsuarioValido(usuario: string): boolean {
  return PATRON_NOMBRE_USUARIO.test(usuario);
}

/**
 * Decide si lo que se escribió en el login es un correo o un nombre de usuario.
 *
 * La arroba es el único criterio, y basta porque los nombres de usuario la
 * tienen prohibida. Si el texto la lleva pero está mal formado, se trata como
 * correo igualmente: así el error que ve la persona habla de su correo en vez
 * de decirle que no existe ese nombre de usuario.
 */
export function pareceCorreo(identificador: string): boolean {
  return identificador.includes("@");
}

/**
 * Normaliza texto para comparar nombres de módulo: sin acentos, en minúsculas y
 * con los separadores unificados a `_`.
 *
 * Es una copia literal de `normalizar` en
 * `packages/core/src/shared/texto.ts` del frontend. Las dos implementaciones
 * tienen que producir el mismo resultado carácter por carácter: si divergen, un
 * módulo llamado "Usuarios y roles" dejaría de casar con la clave
 * `usuarios_roles` y el backend denegaría permisos que el frontend concede.
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
