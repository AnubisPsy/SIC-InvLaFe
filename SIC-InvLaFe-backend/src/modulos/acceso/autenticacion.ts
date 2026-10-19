import { ErrorAutenticacion, ErrorHttp, ErrorInfraestructura } from "../../compartido/errores.js";
import { pareceCorreo } from "../../compartido/validacion.js";
import { obtenerClienteAdmin } from "../../infraestructura/supabase/admin.js";
import {
  traducirErrorAuth,
  traducirErrorPostgrest,
} from "../../infraestructura/supabase/errores.js";
import { crearClientePublico } from "../../infraestructura/supabase/publico.js";
import { TABLAS } from "../../infraestructura/supabase/tablas.js";
import type { Credenciales } from "./esquema.js";
import { buscarUsuarioPorNombreUsuario, type Solicitante } from "./servicio.js";

/**
 * Sesión emitida por Supabase Auth, tal como la necesita el navegador para
 * instalarla con `supabase.auth.setSession`.
 *
 * Se devuelven los dos tokens y nada más: el frontend recompone la sesión
 * completa (usuario, rol y permisos) por su cuenta, exactamente igual que
 * cuando entra por correo sin pasar por aquí.
 */
export interface SesionEmitida {
  accessToken: string;
  refreshToken: string;
}

/**
 * Mensaje único para todo fallo de credenciales.
 *
 * No distingue «no existe ese usuario» de «la contraseña no es esa», y es a
 * propósito: si lo distinguiera, este endpoint se convertiría en una forma de
 * averiguar qué nombres de usuario existen.
 */
const CREDENCIALES_INVALIDAS =
  "El usuario o la contraseña no son correctos.";

/**
 * Inicia sesión aceptando correo **o** nombre de usuario.
 *
 * Existe porque Supabase Auth solo admite correo o teléfono como identificador:
 * el nombre de usuario hay que traducirlo a correo antes de autenticar, y esa
 * traducción necesita leer `usuarios` sin sesión, algo que RLS impide hacer
 * desde el navegador. De ahí que este paso viva en el backend, que es el único
 * con la service key.
 *
 * La autenticación en sí se hace con la clave pública, no con la de
 * administración: la sesión que sale de aquí es idéntica a la que habría
 * obtenido el navegador entrando por su cuenta, sin privilegios extra.
 */
export async function iniciarSesion({
  identificador,
  contrasena,
}: Credenciales): Promise<SesionEmitida> {
  const correo = await resolverCorreo(identificador);

  // Sin correo no hay nada que intentar, pero se responde igual que ante una
  // contraseña incorrecta.
  if (!correo) throw new ErrorAutenticacion(CREDENCIALES_INVALIDAS);

  const { data, error } = await crearClientePublico().auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });

  if (error) throw traducirErrorLogin(error);

  if (!data.session?.access_token || !data.session.refresh_token) {
    throw new ErrorInfraestructura(
      "Supabase no devolvió una sesión utilizable. Intenta de nuevo.",
    );
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  };
}

/**
 * Cambia la contraseña de quien hace la petición y da por cumplido el cambio
 * obligatorio, si lo tenía pendiente.
 *
 * Está aquí y no en el navegador porque son dos escrituras: la contraseña vive
 * en Auth y la marca en `usuarios`, y limpiar la marca desde el cliente exigiría
 * una política de RLS que permitiera a cada persona modificar su propia fila.
 * Antes que abrir esa puerta —una fila donde también viven el rol y el estado
 * activo—, las dos escrituras se hacen aquí.
 *
 * El orden importa: primero la contraseña, después la marca. Si falla lo
 * segundo, la contraseña ya cambió pero el sistema volverá a pedir el cambio en
 * el siguiente acceso. Es el fallo que menos daño hace: molesta, pero nunca
 * deja a nadie con la contraseña que fijó el administrador y la marca limpia.
 */
export async function cambiarContrasenaPropia(
  solicitante: Solicitante,
  contrasena: string,
): Promise<void> {
  const cliente = obtenerClienteAdmin();

  const { error } = await cliente.auth.admin.updateUserById(
    solicitante.authUserId,
    { password: contrasena },
  );

  if (error) throw traducirErrorAuth(error, "cambiar tu contraseña");

  // Sin marca pendiente no hay nada más que hacer: fue un cambio voluntario.
  if (!solicitante.usuario.debeCambiarContrasena) return;

  const { error: errorMarca } = await cliente
    .from(TABLAS.USUARIOS)
    .update({ debe_cambiar_contrasena: false })
    .eq("id", solicitante.usuario.id);

  if (errorMarca) {
    throw traducirErrorPostgrest(errorMarca, "registrar el cambio de contraseña");
  }
}

/** Correo con el que autenticar, o `null` si el identificador no lleva a ninguno. */
async function resolverCorreo(identificador: string): Promise<string | null> {
  if (pareceCorreo(identificador)) return identificador.toLowerCase();

  const usuario = await buscarUsuarioPorNombreUsuario(identificador);
  return usuario?.correo.toLowerCase() ?? null;
}

/**
 * Traduce el fallo de `signInWithPassword`.
 *
 * Casi todo colapsa al mismo mensaje genérico. Se separan solo dos casos que no
 * revelan nada y que sí cambian lo que la persona debe hacer: la cuenta
 * bloqueada (desactivada por un administrador) y el exceso de intentos.
 */
function traducirErrorLogin(error: {
  message?: string;
  code?: string;
  status?: number;
}): ErrorHttp {
  const codigo = error.code ?? "";
  const mensaje = error.message?.toLowerCase() ?? "";

  if (codigo === "user_banned" || mensaje.includes("banned")) {
    return new ErrorAutenticacion(
      "Tu usuario está desactivado. Contacta al administrador.",
    );
  }

  if (codigo.includes("rate_limit") || error.status === 429) {
    return new ErrorHttp(
      429,
      "CONFLICTO",
      "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
      { causaOriginal: error },
    );
  }

  return new ErrorAutenticacion(CREDENCIALES_INVALIDAS);
}
