import { ErrorValidacion } from "../../../shared/errores";
import { esCorreoValido, pareceCorreo } from "../../../shared/texto";
import type { UsuarioDetalle } from "../../acceso/domain/entidades";
import type { ClaveModulo } from "../../acceso/domain/modulos";
import type { MapaPermisos } from "../../acceso/domain/permisos";

/** Identidad devuelta por Supabase Auth, antes de resolver el usuario de negocio. */
export interface SesionAuth {
  authUserId: string;
  correo: string;
}

/**
 * Sesión completa: identidad de Auth + la fila de `usuarios` que le corresponde
 * + los permisos ya resueltos.
 *
 * `usuario` puede ser `null` si alguien tiene cuenta en Auth pero nadie la dio
 * de alta en `usuarios`. En ese caso no hay rol y el mapa queda vacío: la app
 * lo trata como acceso sin permisos, no como sesión inválida, para poder
 * mostrar un mensaje entendible en vez de un error.
 */
export interface Sesion {
  auth: SesionAuth;
  usuario: UsuarioDetalle | null;
  permisos: MapaPermisos;
  /** Módulos del frontend sin fila en `modulos`; diagnóstico para el admin. */
  modulosSinConfigurar: ClaveModulo[];
}

export interface Credenciales {
  /**
   * Lo que la persona escribió para identificarse: su correo o su nombre de
   * usuario. Cuál de los dos es se decide por la arroba, no se pregunta.
   */
  identificador: string;
  contrasena: string;
}

export function usuarioEstaHabilitado(sesion: Sesion | null): boolean {
  return Boolean(sesion?.usuario?.activo && sesion.usuario.rolId);
}

/**
 * Valida lo escrito en el login.
 *
 * El formato solo se comprueba cuando el identificador lleva arroba, porque
 * entonces se sabe que pretendía ser un correo y avisar ahorra un viaje al
 * servidor. Un nombre de usuario, en cambio, se envía tal cual aunque no case
 * con el patrón: decir aquí «ese nombre no es válido» revelaría qué forma
 * tienen los nombres reales, y el mensaje único de credenciales incorrectas que
 * devuelve el backend es justo lo que evita ese goteo de información.
 */
export function validarCredenciales(datos: Credenciales): Credenciales {
  const campos: Record<string, string> = {};

  const identificador = datos.identificador?.trim().toLowerCase() ?? "";
  if (!identificador) {
    campos.identificador = "Escribe tu correo o tu nombre de usuario.";
  } else if (pareceCorreo(identificador) && !esCorreoValido(identificador)) {
    campos.identificador = "El correo no tiene un formato válido.";
  }

  if (!datos.contrasena) {
    campos.contrasena = "Escribe tu contraseña.";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion("Revisa tus credenciales.", campos);
  }

  return { identificador, contrasena: datos.contrasena };
}

export function validarCorreoRecuperacion(correo: string): string {
  const limpio = correo?.trim().toLowerCase() ?? "";
  if (!limpio || !esCorreoValido(limpio)) {
    throw new ErrorValidacion("Revisa el correo.", {
      correo: "Escribe un correo válido para enviarte el enlace.",
    });
  }
  return limpio;
}

export function validarNuevaContrasena(
  contrasena: string,
  confirmacion: string,
): string {
  const campos: Record<string, string> = {};

  if (!contrasena || contrasena.length < 8) {
    campos.contrasena = "La contraseña debe tener al menos 8 caracteres.";
  }
  if (contrasena !== confirmacion) {
    campos.confirmacion = "Las contraseñas no coinciden.";
  }

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion("Revisa la contraseña.", campos);
  }

  return contrasena;
}
