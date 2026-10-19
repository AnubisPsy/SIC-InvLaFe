import { ErrorValidacion } from "../../../shared/errores";
import {
  esCorreoValido,
  esNombreUsuarioValido,
  textoONulo,
} from "../../../shared/texto";
import type { FechaHoraISO, ID } from "../../../shared/tipos";

export interface Rol {
  id: ID;
  nombre: string;
  creadoEn: FechaHoraISO;
}

/**
 * Usuario del sistema. `correo` es la llave que enlaza esta fila con la cuenta
 * de Supabase Auth: la sesión trae el email y con él se resuelve el rol.
 */
export interface Usuario {
  id: ID;
  nombre: string;
  correo: string;
  /**
   * Nombre de usuario con el que puede iniciar sesión en lugar del correo.
   * `null` si no tiene: entonces solo entra por correo.
   */
  usuario: string | null;
  telefono: string | null;
  rolId: ID | null;
  activo: boolean;
  /**
   * Si es `true`, la aplicación lo lleva a definir una contraseña nueva y no lo
   * deja entrar a ningún módulo hasta que lo haga.
   */
  debeCambiarContrasena: boolean;
  creadoEn: FechaHoraISO;
}

export interface UsuarioDetalle extends Usuario {
  rol: Rol | null;
}

export interface DatosUsuario {
  nombre: string;
  correo: string;
  /**
   * Nombre de usuario, opcional. Cadena vacía y `null` significan lo mismo:
   * sin nombre de usuario, se entra solo con el correo.
   */
  usuario: string | null;
  telefono: string | null;
  rolId: ID | null;
  activo: boolean;
  /**
   * Exige definir una contraseña nueva en el primer acceso.
   *
   * Al crear conviene dejarlo en `true`: la contraseña inicial la elige el
   * administrador, así que hasta que el usuario la cambie hay dos personas que
   * la conocen.
   */
  debeCambiarContrasena: boolean;
  /**
   * Contraseña de la cuenta de acceso.
   *
   * Obligatoria al crear, opcional al editar: en blanco significa "deja la que
   * tiene". No se guarda en la tabla `usuarios`, solo viaja al backend, que es
   * quien puede administrar Supabase Auth.
   */
  contrasena?: string;
}

export interface DatosRol {
  nombre: string;
}

// --- Reglas ------------------------------------------------------------------

/** Mínimo que exige Supabase Auth; el backend valida lo mismo. */
export const LARGO_MINIMO_CONTRASENA = 8;

/** Texto de ayuda del campo, y también su mensaje de error. */
export const AYUDA_NOMBRE_USUARIO =
  "Entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo. " +
  "Sin arroba ni espacios.";

export function validarUsuario(
  datos: DatosUsuario,
  opciones: { contrasenaObligatoria?: boolean } = {},
): DatosUsuario {
  const campos: Record<string, string> = {};

  const nombre = datos.nombre?.trim() ?? "";
  if (nombre.length < 2) {
    campos.nombre = "El nombre debe tener al menos 2 caracteres.";
  }

  const correo = datos.correo?.trim().toLowerCase() ?? "";
  if (!correo) {
    campos.correo = "El correo es obligatorio.";
  } else if (!esCorreoValido(correo)) {
    campos.correo = "Escribe un correo válido.";
  }

  // Opcional: sin nombre de usuario la cuenta sigue siendo válida, solo que su
  // dueño tendrá que entrar escribiendo el correo.
  const usuario = textoONulo(datos.usuario)?.toLowerCase() ?? null;
  if (usuario && !esNombreUsuarioValido(usuario)) {
    campos.usuario = AYUDA_NOMBRE_USUARIO;
  }

  const telefono = textoONulo(datos.telefono);
  if (telefono && !/^[\d\s()+-]{7,25}$/.test(telefono)) {
    campos.telefono = "El teléfono solo admite números, espacios y los signos + ( ) -.";
  }

  if (!datos.rolId) {
    campos.rolId = "Asigna un rol: sin rol el usuario no podrá ver nada.";
  }

  // Al crear hay que fijar una contraseña; al editar, dejarla en blanco
  // significa conservar la actual, así que solo se valida si viene algo.
  const contrasena = datos.contrasena ?? "";
  if (opciones.contrasenaObligatoria && !contrasena) {
    campos.contrasena = "Define una contraseña para la cuenta de acceso.";
  } else if (contrasena && contrasena.length < LARGO_MINIMO_CONTRASENA) {
    campos.contrasena = `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;
  }

  if (Object.keys(campos).length > 0) {
    throw new ErrorValidacion("Revisa los datos del usuario.", campos);
  }

  return { ...datos, nombre, correo, usuario, telefono };
}

export function validarRol(datos: DatosRol): DatosRol {
  const nombre = datos.nombre?.trim() ?? "";

  if (nombre.length < 2) {
    throw new ErrorValidacion("Revisa los datos del rol.", {
      nombre: "El nombre del rol debe tener al menos 2 caracteres.",
    });
  }
  if (nombre.length > 60) {
    throw new ErrorValidacion("Revisa los datos del rol.", {
      nombre: "El nombre del rol no puede pasar de 60 caracteres.",
    });
  }

  return { nombre };
}
