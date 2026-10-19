import { ErrorValidacion } from "../../compartido/errores.js";
import { Validador, esObjetoPlano } from "../../compartido/validacion.js";

/**
 * Credenciales del login.
 *
 * `identificador` es lo que la persona escribió: puede ser su correo o su
 * nombre de usuario. Aquí no se decide cuál es ni se valida su formato —de eso
 * se encarga `iniciarSesion`— porque rechazar por formato en esta capa filtraría
 * información: quien probara identificadores sabría cuáles tienen forma de
 * nombre de usuario válido y cuáles no.
 */
export interface Credenciales {
  identificador: string;
  contrasena: string;
}

/** Longitud mínima que exige Supabase Auth por defecto. */
export const LARGO_MINIMO_CONTRASENA = 8;

export function validarNuevaContrasena(cuerpo: unknown): string {
  if (!esObjetoPlano(cuerpo)) {
    throw new ErrorValidacion("El cuerpo de la petición debe ser un objeto JSON.");
  }

  const contrasena =
    typeof cuerpo.contrasena === "string" ? cuerpo.contrasena : "";

  if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
    throw new ErrorValidacion("Revisa la contraseña.", {
      contrasena: `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
    });
  }

  return contrasena;
}

export function validarCredenciales(cuerpo: unknown): Credenciales {
  if (!esObjetoPlano(cuerpo)) {
    throw new ErrorValidacion("El cuerpo de la petición debe ser un objeto JSON.");
  }

  const validador = new Validador();

  const identificador =
    typeof cuerpo.identificador === "string" ? cuerpo.identificador.trim() : "";
  if (!identificador) {
    validador.agregar("identificador", "Escribe tu correo o tu nombre de usuario.");
  } else if (identificador.length > 320) {
    // Tope del largo máximo de una dirección de correo: más que eso no puede
    // ser un identificador legítimo, y evita consultas con textos enormes.
    validador.agregar("identificador", "El identificador es demasiado largo.");
  }

  const contrasena = typeof cuerpo.contrasena === "string" ? cuerpo.contrasena : "";
  if (!contrasena) {
    validador.agregar("contrasena", "Escribe tu contraseña.");
  }

  validador.lanzarSiFalla("Revisa tus credenciales.");

  return { identificador, contrasena };
}
