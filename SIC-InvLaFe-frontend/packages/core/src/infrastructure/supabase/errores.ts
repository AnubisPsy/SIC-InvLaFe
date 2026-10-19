import type { PostgrestError } from "@supabase/supabase-js";
import {
  ErrorApp,
  ErrorAutenticacion,
  ErrorConflicto,
  ErrorInfraestructura,
  ErrorPermisoDenegado,
} from "../../shared/errores";

/**
 * Traduce un error de PostgREST a la jerarquía del dominio.
 *
 * Sin esto, la UI tendría que conocer códigos SQL para decidir qué mensaje
 * mostrar, y el mensaje crudo de Postgres ("duplicate key value violates unique
 * constraint...") no le dice nada al encargado del negocio.
 */
export function traducirErrorPostgrest(
  error: PostgrestError,
  contexto: string,
): ErrorApp {
  switch (error.code) {
    // RLS rechazó la operación: la política del rol no la permite.
    case "42501":
    case "PGRST301":
      return new ErrorPermisoDenegado(
        `No tienes permiso para ${contexto}. Verifica el rol asignado a tu usuario.`,
      );

    case "23505": // unique_violation
      return new ErrorConflicto(
        "Ya existe un registro con esos datos.",
        error.details,
      );

    case "23503": // foreign_key_violation
      return new ErrorConflicto(
        "No se puede completar: el registro está referenciado por otros datos.",
        error.details,
      );

    case "23502": // not_null_violation
      return new ErrorConflicto(
        "Faltan datos obligatorios para guardar el registro.",
        error.details,
      );

    case "23514": // check_violation
      return new ErrorConflicto(
        "Los datos no cumplen una validación de la base de datos.",
        error.details,
      );

    case "PGRST204": // columna inexistente en el payload
      return new ErrorInfraestructura(
        "La estructura de la base no coincide con la esperada por la aplicación.",
        error.message,
      );

    default:
      return new ErrorInfraestructura(
        `No se pudo ${contexto}. ${error.message}`,
        error,
      );
  }
}

/** Traduce los errores de Supabase Auth a mensajes accionables en español. */
export function traducirErrorAuth(error: { message: string; code?: string; status?: number }): ErrorApp {
  const mensaje = error.message?.toLowerCase() ?? "";
  const codigo = error.code ?? "";

  if (codigo === "invalid_credentials" || mensaje.includes("invalid login credentials")) {
    return new ErrorAutenticacion("Correo o contraseña incorrectos.");
  }
  if (codigo === "email_not_confirmed" || mensaje.includes("email not confirmed")) {
    return new ErrorAutenticacion(
      "Tu correo aún no está confirmado. Revisa tu bandeja de entrada.",
    );
  }
  if (codigo.includes("rate_limit") || error.status === 429) {
    return new ErrorAutenticacion(
      "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
    );
  }
  if (codigo === "same_password") {
    return new ErrorAutenticacion(
      "La nueva contraseña debe ser distinta de la actual.",
    );
  }
  if (codigo === "weak_password" || mensaje.includes("password should be")) {
    return new ErrorAutenticacion(
      "La contraseña es demasiado débil. Usa al menos 8 caracteres.",
    );
  }
  if (mensaje.includes("auth session missing") || error.status === 401) {
    return new ErrorAutenticacion(
      "Tu sesión expiró. Vuelve a iniciar sesión.",
    );
  }

  return new ErrorAutenticacion(error.message || "No se pudo completar la operación.");
}

/**
 * Envuelve una llamada a PostgREST: lanza el error traducido o devuelve los datos.
 * Centraliza el `if (error) throw` que de otro modo se repetiría en cada método.
 */
export async function ejecutar<T>(
  operacion: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  contexto: string,
): Promise<T> {
  const { data, error } = await operacion;
  if (error) throw traducirErrorPostgrest(error, contexto);
  if (data === null) {
    throw new ErrorInfraestructura(`No se pudo ${contexto}: la base no devolvió datos.`);
  }
  return data;
}

/** Igual que `ejecutar`, pero acepta que la consulta no devuelva filas. */
export async function ejecutarOpcional<T>(
  operacion: PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  contexto: string,
): Promise<T | null> {
  const { data, error } = await operacion;
  if (error) {
    // PGRST116 = `.single()` sin filas. Es un "no existe", no un fallo.
    if (error.code === "PGRST116") return null;
    throw traducirErrorPostgrest(error, contexto);
  }
  return data;
}

/** Para DELETE/UPDATE que no devuelven payload. */
export async function ejecutarSinRetorno(
  operacion: PromiseLike<{ error: PostgrestError | null }>,
  contexto: string,
): Promise<void> {
  const { error } = await operacion;
  if (error) throw traducirErrorPostgrest(error, contexto);
}
