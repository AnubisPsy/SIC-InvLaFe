import "dotenv/config";

/**
 * Lectura y validación de las variables de entorno.
 *
 * A diferencia del frontend, aquí se valida al arrancar y de forma agresiva: un
 * backend a medio configurar que acepta peticiones es peor que uno que no
 * arranca, porque los fallos aparecerían más tarde y como errores 500 opacos.
 */
export interface Entorno {
  puerto: number;
  esProduccion: boolean;
  /** Orígenes extra que CORS acepta, además del propio. Puede estar vacío. */
  origenesPermitidos: string[];
  /** Cadena de conexión a PostgreSQL: postgres://usuario:clave@host:puerto/base */
  baseDatosUrl: string;
  /** Clave con la que se firman y verifican los tokens de sesión (JWT). */
  jwtSecreto: string;
  /** Cuánto dura una sesión antes de pedir login otra vez, p. ej. "8h". */
  jwtDuracion: string;
}

function obligatoria(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}.\n` +
        "Copia .env.example a .env y completa los valores.",
    );
  }
  return valor;
}

/**
 * Orígenes extra que CORS acepta, separados por comas. Puede ir vacía: las
 * peticiones del mismo origen (la app servida por nginx) se aceptan siempre.
 * En desarrollo hace falta el de Vite, p. ej. http://localhost:5173
 */
function listaDeOrigenes(crudo: string | undefined): string[] {
  return (crudo ?? "")
    .split(",")
    .map((origen) => origen.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function puerto(crudo: string | undefined): number {
  const numero = Number(crudo ?? 3000);
  if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
    throw new Error(`PORT no es un puerto válido: ${crudo}`);
  }
  return numero;
}

let memoizado: Entorno | null = null;

export function leerEntorno(): Entorno {
  if (memoizado) return memoizado;

  const jwtSecreto = obligatoria("JWT_SECRETO");
  if (jwtSecreto.length < 32) {
    throw new Error(
      "JWT_SECRETO es demasiado corto: usa al menos 32 caracteres aleatorios.\n" +
        "Puedes generar uno con: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
    );
  }

  memoizado = {
    puerto: puerto(process.env.PORT),
    esProduccion: process.env.NODE_ENV === "production",
    origenesPermitidos: listaDeOrigenes(process.env.CORS_ORIGENES),
    baseDatosUrl: obligatoria("DATABASE_URL"),
    jwtSecreto,
    jwtDuracion: process.env.JWT_DURACION?.trim() || "8h",
  };

  return memoizado;
}
