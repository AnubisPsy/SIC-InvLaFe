import bcrypt from "bcryptjs";
import { ErrorAutenticacion } from "../../compartido/errores.js";
import { emitirToken, type TokenEmitido } from "../../compartido/tokens.js";
import { pareceCorreo } from "../../compartido/validacion.js";
import { consultar } from "../../infraestructura/db/pool.js";
import type { Credenciales } from "./esquema.js";
import {
  buscarUsuarioPorCorreo,
  buscarUsuarioPorNombreUsuario,
  obtenerHashContrasena,
  type Solicitante,
} from "./servicio.js";

/** Lo que recibe el navegador al iniciar sesión. */
export interface SesionEmitida extends TokenEmitido {
  usuarioId: string;
  correo: string;
}

/**
 * Mensaje único para todo fallo de credenciales.
 *
 * No distingue «no existe ese usuario» de «la contraseña no es esa», y es a
 * propósito: si lo distinguiera, este endpoint serviría para averiguar qué
 * usuarios existen.
 */
const CREDENCIALES_INVALIDAS = "El usuario o la contraseña no son correctos.";

/** Rondas de cifrado de bcrypt. 10 es el estándar. */
const RONDAS_BCRYPT = 10;

/**
 * Hash de relleno para cuando el usuario no existe. Comparar contra él tarda lo
 * mismo que una comparación real, así el tiempo de respuesta no delata si el
 * usuario existe o no.
 */
const HASH_DE_RELLENO = bcrypt.hashSync("relleno-sin-uso", RONDAS_BCRYPT);

/** Inicia sesión aceptando correo **o** nombre de usuario. */
export async function iniciarSesion({
  identificador,
  contrasena,
}: Credenciales): Promise<SesionEmitida> {
  const usuario = pareceCorreo(identificador)
    ? await buscarUsuarioPorCorreo(identificador)
    : await buscarUsuarioPorNombreUsuario(identificador);

  const hash = usuario ? await obtenerHashContrasena(usuario.id) : null;
  const coincide = await bcrypt.compare(contrasena, hash ?? HASH_DE_RELLENO);

  if (!usuario || !hash || !coincide) {
    throw new ErrorAutenticacion(CREDENCIALES_INVALIDAS);
  }

  // Solo se revela que está desactivado a quien ya demostró saber la contraseña.
  if (!usuario.activo) {
    throw new ErrorAutenticacion("Tu usuario está desactivado. Contacta al administrador.");
  }

  return {
    ...emitirToken(usuario.id),
    usuarioId: usuario.id,
    correo: usuario.correo.toLowerCase(),
  };
}

/**
 * Cambia la contraseña de quien hace la petición y da por cumplido el cambio
 * obligatorio, si lo tenía pendiente. Ambas cosas en una sola consulta.
 */
export async function cambiarContrasenaPropia(
  solicitante: Solicitante,
  contrasena: string,
): Promise<void> {
  const hash = await cifrarContrasena(contrasena);

  await consultar(
    "update usuarios set contrasena_hash = $1, debe_cambiar_contrasena = false where id = $2",
    [hash, solicitante.usuario.id],
    "cambiar tu contraseña",
  );
}

/** Cifra una contraseña con bcrypt. La usa también el alta de usuarios. */
export function cifrarContrasena(contrasena: string): Promise<string> {
  return bcrypt.hash(contrasena, RONDAS_BCRYPT);
}
