/**
 * Jerarquía de errores de la API.
 *
 * Todo lo que se lance desde una ruta acaba en el manejador central de errores,
 * que solo sabe leer estas propiedades. Un error que no sea `ErrorHttp` se
 * traduce a un 500 genérico sin filtrar detalles internos al cliente.
 *
 * Los códigos son los mismos que usa el dominio del frontend
 * (`packages/core/src/shared/errores.ts`), para que el adaptador HTTP pueda
 * reconstruir el `ErrorApp` equivalente sin tablas de conversión.
 */
export type CodigoError =
  | "VALIDACION"
  | "NO_ENCONTRADO"
  | "CONFLICTO"
  | "PERMISO_DENEGADO"
  | "AUTENTICACION"
  | "INFRAESTRUCTURA";

export class ErrorHttp extends Error {
  readonly estado: number;
  readonly codigo: CodigoError;
  /** Errores por campo, para pintarlos junto a cada input del formulario. */
  readonly campos: Record<string, string> | undefined;
  /** Contexto para el log del servidor. Nunca se envía al cliente. */
  readonly causaOriginal: unknown;

  constructor(
    estado: number,
    codigo: CodigoError,
    mensaje: string,
    opciones: {
      campos?: Record<string, string>;
      causaOriginal?: unknown;
    } = {},
  ) {
    super(mensaje);
    this.name = new.target.name;
    this.estado = estado;
    this.codigo = codigo;
    this.campos = opciones.campos;
    this.causaOriginal = opciones.causaOriginal;
  }
}

/** 400 — el cuerpo de la petición no cumple las reglas. */
export class ErrorValidacion extends ErrorHttp {
  constructor(mensaje: string, campos: Record<string, string> = {}) {
    super(400, "VALIDACION", mensaje, { campos });
  }
}

/** 401 — falta el token, está mal formado o expiró. */
export class ErrorAutenticacion extends ErrorHttp {
  constructor(mensaje = "Tu sesión expiró. Vuelve a iniciar sesión.") {
    super(401, "AUTENTICACION", mensaje);
  }
}

/** 403 — hay sesión válida, pero el rol no incluye la acción. */
export class ErrorPermisoDenegado extends ErrorHttp {
  constructor(mensaje = "No tienes permiso para realizar esta acción.") {
    super(403, "PERMISO_DENEGADO", mensaje);
  }
}

/** 404 — el recurso no existe. */
export class ErrorNoEncontrado extends ErrorHttp {
  constructor(mensaje: string) {
    super(404, "NO_ENCONTRADO", mensaje);
  }
}

/** 409 — el estado actual impide la operación (correo duplicado, etc.). */
export class ErrorConflicto extends ErrorHttp {
  constructor(mensaje: string, causaOriginal?: unknown) {
    super(409, "CONFLICTO", mensaje, { causaOriginal });
  }
}

/** 502 — Supabase falló o no respondió. No es culpa de quien llama. */
export class ErrorInfraestructura extends ErrorHttp {
  constructor(
    mensaje = "No se pudo completar la operación. Intenta de nuevo.",
    causaOriginal?: unknown,
  ) {
    super(502, "INFRAESTRUCTURA", mensaje, { causaOriginal });
  }
}

export function esErrorHttp(valor: unknown): valor is ErrorHttp {
  return valor instanceof ErrorHttp;
}

/** Forma exacta del cuerpo JSON que devuelve la API cuando algo falla. */
export interface CuerpoError {
  error: {
    codigo: CodigoError;
    mensaje: string;
    campos?: Record<string, string>;
  };
}
