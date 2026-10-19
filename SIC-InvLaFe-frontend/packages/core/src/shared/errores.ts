/**
 * Jerarquía de errores del dominio.
 *
 * Los casos de uso lanzan estos errores en lugar de devolver `Result`, porque
 * TanStack Query ya modela el fallo como estado (`query.error` / `mutation.error`)
 * y la UI solo necesita leer `error.mensajeUsuario`.
 */
export type CodigoError =
  | "VALIDACION"
  | "NO_ENCONTRADO"
  | "CONFLICTO"
  | "PERMISO_DENEGADO"
  | "AUTENTICACION"
  | "INFRAESTRUCTURA";

export class ErrorApp extends Error {
  readonly codigo: CodigoError;
  /** Texto seguro para mostrar directamente al usuario final. */
  readonly mensajeUsuario: string;
  readonly detalle: unknown;

  constructor(
    codigo: CodigoError,
    mensajeUsuario: string,
    detalle?: unknown,
  ) {
    super(mensajeUsuario);
    this.name = new.target.name;
    this.codigo = codigo;
    this.mensajeUsuario = mensajeUsuario;
    this.detalle = detalle;
  }
}

/** Datos de entrada inválidos según las reglas de negocio. */
export class ErrorValidacion extends ErrorApp {
  /** Errores por campo, para pintarlos junto a cada input. */
  readonly campos: Record<string, string>;

  constructor(mensajeUsuario: string, campos: Record<string, string> = {}) {
    super("VALIDACION", mensajeUsuario, campos);
    this.campos = campos;
  }
}

/** El recurso solicitado no existe (o RLS lo oculta, que es indistinguible). */
export class ErrorNoEncontrado extends ErrorApp {
  constructor(recurso: string, id?: string) {
    super(
      "NO_ENCONTRADO",
      id ? `No se encontró ${recurso} con id ${id}.` : `No se encontró ${recurso}.`,
    );
  }
}

/**
 * El estado actual impide la operación: existencia insuficiente en el lote,
 * abono mayor al saldo, o una escritura concurrente que ganó la carrera.
 */
export class ErrorConflicto extends ErrorApp {
  constructor(mensajeUsuario: string, detalle?: unknown) {
    super("CONFLICTO", mensajeUsuario, detalle);
  }
}

/** El rol del usuario no incluye la acción sobre el módulo. */
export class ErrorPermisoDenegado extends ErrorApp {
  constructor(mensajeUsuario = "No tienes permiso para realizar esta acción.") {
    super("PERMISO_DENEGADO", mensajeUsuario);
  }
}

/** Sesión ausente, expirada o credenciales incorrectas. */
export class ErrorAutenticacion extends ErrorApp {
  constructor(mensajeUsuario: string, detalle?: unknown) {
    super("AUTENTICACION", mensajeUsuario, detalle);
  }
}

/** Fallo de red, de Supabase o cualquier cosa fuera del control del dominio. */
export class ErrorInfraestructura extends ErrorApp {
  constructor(
    mensajeUsuario = "Ocurrió un error de conexión. Intenta de nuevo.",
    detalle?: unknown,
  ) {
    super("INFRAESTRUCTURA", mensajeUsuario, detalle);
  }
}

export function esErrorApp(valor: unknown): valor is ErrorApp {
  return valor instanceof ErrorApp;
}

/** Extrae un mensaje presentable de cualquier cosa que haya sido lanzada. */
export function mensajeDeError(valor: unknown): string {
  if (esErrorApp(valor)) return valor.mensajeUsuario;
  if (valor instanceof Error) return valor.message;
  return "Ocurrió un error inesperado.";
}
