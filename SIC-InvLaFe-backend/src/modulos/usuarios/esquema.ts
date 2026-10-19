import { ErrorValidacion } from "../../compartido/errores.js";
import {
  Validador,
  esCorreoValido,
  esNombreUsuarioValido,
  esObjetoPlano,
  esTelefonoValido,
  textoONulo,
} from "../../compartido/validacion.js";

/** Longitud mínima de una contraseña. */
export const LARGO_MINIMO_CONTRASENA = 8;

export interface DatosCrearUsuario {
  nombre: string;
  correo: string;
  /** Nombre de usuario para iniciar sesión. Opcional: `null` = solo por correo. */
  usuario: string | null;
  telefono: string | null;
  rolId: string;
  activo: boolean;
  contrasena: string;
  /**
   * Obliga a definir una contraseña nueva en el primer acceso.
   *
   * Por defecto `true`: la contraseña del alta la elige el administrador, así
   * que hasta que el usuario la cambie hay dos personas que la conocen.
   */
  debeCambiarContrasena: boolean;
}

/**
 * Deja el nombre de usuario en minúsculas.
 *
 * Se guarda normalizado para poder buscarlo con una igualdad exacta en vez de
 * con `ilike`, que interpretaría el `_` —permitido en los nombres— como
 * comodín. Ver `buscarUsuarioPorNombreUsuario`.
 */
export function normalizarNombreUsuario(valor: unknown): string | null {
  const texto = textoONulo(valor);
  return texto ? texto.toLowerCase() : null;
}

const AYUDA_NOMBRE_USUARIO =
  "Entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo. " +
  "Sin arroba ni espacios.";

/**
 * Cambios de una edición. Todos los campos son opcionales: se aplica solo lo
 * que venga, y `undefined` significa "no tocar" (distinto de `null`, que en
 * `telefono` significa "vaciar").
 */
export interface DatosEditarUsuario {
  nombre?: string;
  correo?: string;
  /** `null` borra el nombre de usuario y deja la cuenta accesible solo por correo. */
  usuario?: string | null;
  telefono?: string | null;
  rolId?: string;
  activo?: boolean;
  contrasena?: string;
  debeCambiarContrasena?: boolean;
}

function cuerpoDeObjeto(cuerpo: unknown): Record<string, unknown> {
  if (!esObjetoPlano(cuerpo)) {
    throw new ErrorValidacion("El cuerpo de la petición debe ser un objeto JSON.");
  }
  return cuerpo;
}

/**
 * Valida el alta de un usuario.
 *
 * Replica las reglas de `validarUsuario` del frontend
 * (`packages/core/src/modules/acceso/domain/entidades.ts`) y añade la
 * contraseña, que allí no existe. La duplicación es deliberada: la validación
 * del navegador es una comodidad para el usuario, no una garantía, porque nada
 * impide llamar a esta API directamente.
 */
export function validarCrearUsuario(cuerpo: unknown): DatosCrearUsuario {
  const datos = cuerpoDeObjeto(cuerpo);
  const validador = new Validador();

  const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
  if (nombre.length < 2) {
    validador.agregar("nombre", "El nombre debe tener al menos 2 caracteres.");
  }

  const correo =
    typeof datos.correo === "string" ? datos.correo.trim().toLowerCase() : "";
  if (!correo) {
    validador.agregar("correo", "El correo es obligatorio.");
  } else if (!esCorreoValido(correo)) {
    validador.agregar("correo", "Escribe un correo válido.");
  }

  const usuario = normalizarNombreUsuario(datos.usuario);
  if (usuario && !esNombreUsuarioValido(usuario)) {
    validador.agregar("usuario", AYUDA_NOMBRE_USUARIO);
  }

  const telefono = textoONulo(datos.telefono);
  if (telefono && !esTelefonoValido(telefono)) {
    validador.agregar(
      "telefono",
      "El teléfono solo admite números, espacios y los signos + ( ) -.",
    );
  }

  const rolId = textoONulo(datos.rolId);
  if (!rolId) {
    validador.agregar("rolId", "Asigna un rol: sin rol el usuario no podrá ver nada.");
  }

  const contrasena = typeof datos.contrasena === "string" ? datos.contrasena : "";
  if (!contrasena) {
    validador.agregar("contrasena", "La contraseña es obligatoria.");
  } else if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
    validador.agregar(
      "contrasena",
      `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
    );
  }

  validador.lanzarSiFalla("Revisa los datos del usuario.");

  return {
    nombre,
    correo,
    usuario,
    telefono,
    rolId: rolId as string,
    activo: typeof datos.activo === "boolean" ? datos.activo : true,
    contrasena,
    // Se exige salvo que se pida explícitamente lo contrario: quien no envíe el
    // campo obtiene el comportamiento seguro.
    debeCambiarContrasena:
      typeof datos.debeCambiarContrasena === "boolean"
        ? datos.debeCambiarContrasena
        : true,
  };
}

export function validarEditarUsuario(cuerpo: unknown): DatosEditarUsuario {
  const datos = cuerpoDeObjeto(cuerpo);
  const validador = new Validador();
  const cambios: DatosEditarUsuario = {};

  if (datos.nombre !== undefined) {
    const nombre = typeof datos.nombre === "string" ? datos.nombre.trim() : "";
    if (nombre.length < 2) {
      validador.agregar("nombre", "El nombre debe tener al menos 2 caracteres.");
    }
    cambios.nombre = nombre;
  }

  if (datos.correo !== undefined) {
    const correo =
      typeof datos.correo === "string" ? datos.correo.trim().toLowerCase() : "";
    if (!correo) {
      validador.agregar("correo", "El correo es obligatorio.");
    } else if (!esCorreoValido(correo)) {
      validador.agregar("correo", "Escribe un correo válido.");
    }
    cambios.correo = correo;
  }

  // `null` y `""` son la forma de quitar el nombre de usuario, así que se
  // aceptan: a diferencia del correo, no dejan la cuenta sin identificador.
  if (datos.usuario !== undefined) {
    const usuario = normalizarNombreUsuario(datos.usuario);
    if (usuario && !esNombreUsuarioValido(usuario)) {
      validador.agregar("usuario", AYUDA_NOMBRE_USUARIO);
    }
    cambios.usuario = usuario;
  }

  if (datos.telefono !== undefined) {
    const telefono = textoONulo(datos.telefono);
    if (telefono && !esTelefonoValido(telefono)) {
      validador.agregar(
        "telefono",
        "El teléfono solo admite números, espacios y los signos + ( ) -.",
      );
    }
    cambios.telefono = telefono;
  }

  if (datos.rolId !== undefined) {
    const rolId = textoONulo(datos.rolId);
    if (!rolId) {
      validador.agregar("rolId", "Asigna un rol: sin rol el usuario no podrá ver nada.");
    } else {
      cambios.rolId = rolId;
    }
  }

  if (datos.activo !== undefined) {
    if (typeof datos.activo !== "boolean") {
      validador.agregar("activo", "El estado debe ser verdadero o falso.");
    } else {
      cambios.activo = datos.activo;
    }
  }

  if (datos.debeCambiarContrasena !== undefined) {
    if (typeof datos.debeCambiarContrasena !== "boolean") {
      validador.agregar(
        "debeCambiarContrasena",
        "El cambio obligatorio debe ser verdadero o falso.",
      );
    } else {
      cambios.debeCambiarContrasena = datos.debeCambiarContrasena;
    }
  }

  // Una contraseña vacía se ignora en lugar de rechazarse: el formulario deja
  // el campo en blanco cuando no se quiere cambiar.
  if (datos.contrasena !== undefined && datos.contrasena !== "" && datos.contrasena !== null) {
    const contrasena = typeof datos.contrasena === "string" ? datos.contrasena : "";
    if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
      validador.agregar(
        "contrasena",
        `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
      );
    } else {
      cambios.contrasena = contrasena;
    }
  }

  validador.lanzarSiFalla("Revisa los datos del usuario.");

  if (Object.keys(cambios).length === 0) {
    throw new ErrorValidacion("No enviaste ningún cambio.");
  }

  return cambios;
}
