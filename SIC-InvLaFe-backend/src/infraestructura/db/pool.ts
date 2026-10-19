import pg from "pg";
import {
  ErrorConflicto,
  ErrorHttp,
  ErrorInfraestructura,
  ErrorValidacion,
} from "../../compartido/errores.js";
import { leerEntorno } from "../../config/entorno.js";

/**
 * Conexión a PostgreSQL.
 *
 * Un *pool* mantiene unas pocas conexiones abiertas y las reparte entre las
 * peticiones, en lugar de abrir y cerrar una por cada consulta.
 */

// Por defecto `pg` devuelve `numeric` y `bigint` como texto, y `date` como un
// objeto Date en hora local (que puede correr el día). Se ajustan para que el
// JSON salga igual que lo entregaba Supabase: números y fechas "YYYY-MM-DD".
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valor) => Number(valor));
pg.types.setTypeParser(pg.types.builtins.INT8, (valor) => Number(valor));
pg.types.setTypeParser(pg.types.builtins.DATE, (valor) => valor);

const leerFechaHora = pg.types.getTypeParser(pg.types.builtins.TIMESTAMPTZ);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (valor) =>
  (leerFechaHora(valor) as Date).toISOString(),
);

/** Cualquier objeto que pueda ejecutar consultas: el pool o una conexión en transacción. */
export type Ejecutor = Pick<pg.Pool, "query"> | pg.PoolClient;

let pool: pg.Pool | null = null;

export function obtenerPool(): pg.Pool {
  if (pool) return pool;

  pool = new pg.Pool({ connectionString: leerEntorno().baseDatosUrl, max: 10 });

  // Una conexión inactiva que se cae no debe tumbar el proceso.
  pool.on("error", (error) => {
    console.error("Error en una conexión inactiva de PostgreSQL:", error);
  });

  return pool;
}

/** Ejecuta una consulta y devuelve todas las filas. */
export async function consultar<T extends pg.QueryResultRow>(
  sql: string,
  parametros: unknown[] = [],
  contexto = "consultar la base de datos",
  ejecutor: Ejecutor = obtenerPool(),
): Promise<T[]> {
  try {
    const resultado = await ejecutor.query<T>(sql, parametros);
    return resultado.rows;
  } catch (error) {
    throw traducirErrorPg(error, contexto);
  }
}

/** Igual que `consultar`, pero devuelve solo la primera fila o `null`. */
export async function consultarUno<T extends pg.QueryResultRow>(
  sql: string,
  parametros: unknown[] = [],
  contexto = "consultar la base de datos",
  ejecutor: Ejecutor = obtenerPool(),
): Promise<T | null> {
  const filas = await consultar<T>(sql, parametros, contexto, ejecutor);
  return filas[0] ?? null;
}

/**
 * Ejecuta varias consultas como una sola operación: o se guardan todas o
 * ninguna. Si `trabajo` lanza un error, se deshace todo lo hecho dentro.
 */
export async function transaccion<T>(
  trabajo: (cliente: pg.PoolClient) => Promise<T>,
  contexto = "guardar los cambios",
): Promise<T> {
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query("BEGIN");
    const resultado = await trabajo(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw traducirErrorPg(error, contexto);
  } finally {
    cliente.release();
  }
}

/** Traduce los códigos de error de PostgreSQL a la jerarquía de la API. */
export function traducirErrorPg(error: unknown, contexto: string): ErrorHttp {
  if (error instanceof ErrorHttp) return error;

  const codigo = (error as { code?: unknown } | null)?.code;

  switch (codigo) {
    case "23505": // unique_violation
      return new ErrorConflicto("Ya existe un registro con esos datos.", error);
    case "23503": // foreign_key_violation
      return new ErrorConflicto(
        "No se puede completar: el registro está referenciado por otros datos, " +
          "o hace referencia a uno que no existe.",
        error,
      );
    case "23502": // not_null_violation
      return new ErrorConflicto("Faltan datos obligatorios para guardar el registro.", error);
    case "23514": // check_violation
      return new ErrorConflicto(
        "Los datos no cumplen una validación de la base de datos.",
        error,
      );
    case "22P02": // invalid_text_representation (p. ej. un id que no es UUID)
      return new ErrorValidacion("Algún dato enviado no tiene un formato válido.");
    case "42703": // undefined_column
    case "42P01": // undefined_table
      return new ErrorInfraestructura(
        "La estructura de la base no coincide con la esperada por el servidor.",
        error,
      );
    default:
      return new ErrorInfraestructura(`No se pudo ${contexto}.`, error);
  }
}

/** Comprueba que la base responde. Lo usa la sonda de salud. */
export async function baseDisponible(): Promise<boolean> {
  try {
    await obtenerPool().query("select 1");
    return true;
  } catch {
    return false;
  }
}

/** Cierra todas las conexiones. Se llama al apagar el servidor. */
export async function cerrarPool(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}
