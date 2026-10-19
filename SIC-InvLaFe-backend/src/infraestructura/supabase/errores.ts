import type { PostgrestError } from "@supabase/supabase-js";
import {
  ErrorConflicto,
  ErrorHttp,
  ErrorInfraestructura,
} from "../../compartido/errores.js";

/**
 * Traduce un error de PostgREST a la jerarquía de la API.
 *
 * Nótese que aquí no hay caso para `42501` (RLS): el cliente admin ignora las
 * políticas, así que un rechazo por permisos es imposible por esta vía. Si
 * apareciera, significa que se está usando la clave equivocada, y el mensaje
 * genérico de infraestructura lo dejará ver en los logs.
 */
export function traducirErrorPostgrest(
  error: PostgrestError,
  contexto: string,
): ErrorHttp {
  switch (error.code) {
    case "23505": // unique_violation
      return new ErrorConflicto("Ya existe un registro con esos datos.", error);

    case "23503": // foreign_key_violation
      return new ErrorConflicto(
        "No se puede completar: el registro está referenciado por otros datos, " +
          "o el rol asignado no existe.",
        error,
      );

    case "23502": // not_null_violation
      return new ErrorConflicto("Faltan datos obligatorios para guardar el registro.", error);

    case "23514": // check_violation
      return new ErrorConflicto(
        "Los datos no cumplen una validación de la base de datos.",
        error,
      );

    // Columna que el servidor espera y la base no tiene. Son dos códigos porque
    // PostgREST los reparte según dónde aparezca: `PGRST204` al escribirla en el
    // payload, `42703` al pedirla en un `select` o un filtro. Casi siempre
    // significan lo mismo: el esquema se quedó atrás respecto al código.
    case "PGRST204":
    case "42703":
      return new ErrorInfraestructura(
        "La estructura de la base no coincide con la esperada por el servidor. " +
          "Revisa que las tablas tengan las columnas que documenta el README.",
        error,
      );

    default:
      return new ErrorInfraestructura(`No se pudo ${contexto}.`, error);
  }
}

/** `true` si el fallo se debe a que la columna del payload no existe. */
export function esColumnaInexistente(error: PostgrestError | null): boolean {
  return error?.code === "PGRST204";
}

/**
 * Traduce los errores de Supabase Auth (incluido `auth.admin`) a mensajes
 * accionables en español.
 */
export function traducirErrorAuth(
  error: { message?: string; code?: string; status?: number },
  contexto: string,
): ErrorHttp {
  const mensaje = error.message?.toLowerCase() ?? "";
  const codigo = error.code ?? "";

  if (
    codigo === "email_exists" ||
    codigo === "user_already_exists" ||
    mensaje.includes("already been registered") ||
    mensaje.includes("already registered") ||
    mensaje.includes("already exists")
  ) {
    return new ErrorConflicto(
      "Ya existe una cuenta de acceso con ese correo.",
      error,
    );
  }

  if (codigo === "weak_password" || mensaje.includes("password should be")) {
    return new ErrorHttp(400, "VALIDACION", "La contraseña es demasiado débil.", {
      campos: { contrasena: "Usa al menos 8 caracteres." },
      causaOriginal: error,
    });
  }

  if (codigo === "validation_failed" || mensaje.includes("unable to validate email")) {
    return new ErrorHttp(400, "VALIDACION", "Revisa los datos del usuario.", {
      campos: { correo: "Supabase no acepta este correo." },
      causaOriginal: error,
    });
  }

  if (codigo.includes("rate_limit") || error.status === 429) {
    return new ErrorHttp(
      429,
      "CONFLICTO",
      "Demasiados intentos. Espera un momento antes de volver a intentarlo.",
      { causaOriginal: error },
    );
  }

  if (codigo === "user_not_found" || error.status === 404) {
    return new ErrorHttp(
      404,
      "NO_ENCONTRADO",
      "La cuenta de acceso ya no existe en Supabase Auth.",
      { causaOriginal: error },
    );
  }

  return new ErrorInfraestructura(`No se pudo ${contexto}.`, error);
}

/**
 * Envuelve una llamada a PostgREST: lanza el error traducido o devuelve los
 * datos. Centraliza el `if (error) throw` que se repetiría en cada consulta.
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
