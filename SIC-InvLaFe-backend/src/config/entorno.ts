import "dotenv/config";

/**
 * Lectura y validación de las variables de entorno.
 *
 * A diferencia del frontend, aquí se valida al arrancar y de forma agresiva: un
 * backend a medio configurar que acepta peticiones es peor que uno que no
 * arranca, porque los fallos aparecerían más tarde y como errores 500 opacos.
 */
export interface Entorno {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  /**
   * Publishable/anon key, la misma que usa el navegador.
   *
   * La necesita el login por nombre de usuario: tras traducir el nombre a
   * correo con privilegios de administración, la autenticación en sí se hace
   * como un cliente cualquiera, para que la sesión resultante tenga exactamente
   * los mismos permisos que si el navegador hubiera entrado por su cuenta.
   */
  supabasePublishableKey: string;
  puerto: number;
  esProduccion: boolean;
  /** Orígenes que CORS acepta. Nunca está vacío: si lo estuviera, no arranca. */
  origenesPermitidos: string[];
}

function obligatoria(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}.\n` +
        "Copia .env.example a .env y completa los valores del proyecto de Supabase.",
    );
  }
  return valor;
}

function listaDeOrigenes(crudo: string | undefined): string[] {
  const origenes = (crudo ?? "")
    .split(",")
    .map((origen) => origen.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  if (origenes.length === 0) {
    throw new Error(
      "Falta la variable de entorno CORS_ORIGENES.\n" +
        "Indica al menos el origen del frontend, por ejemplo http://localhost:5173",
    );
  }
  return origenes;
}

function puerto(crudo: string | undefined): number {
  const numero = Number(crudo ?? 3000);
  if (!Number.isInteger(numero) || numero < 1 || numero > 65535) {
    throw new Error(`PORT no es un puerto válido: ${crudo}`);
  }
  return numero;
}

/**
 * `true` si la clave es un JWT heredado cuyo `role` es `service_role`.
 *
 * Los dos formatos heredados —anon y service_role— empiezan igual (`eyJ`), así
 * que el prefijo no basta para distinguirlos: hay que mirar dentro. No se
 * verifica la firma porque no es una comprobación de seguridad, sino una ayuda
 * para no arrancar con la clave equivocada en la variable equivocada.
 */
function esJwtDeServiceRole(clave: string): boolean {
  const partes = clave.split(".");
  if (partes.length !== 3 || !partes[1]) return false;

  try {
    const carga: unknown = JSON.parse(
      Buffer.from(partes[1], "base64url").toString("utf8"),
    );
    return (
      typeof carga === "object" &&
      carga !== null &&
      (carga as { role?: unknown }).role === "service_role"
    );
  } catch {
    // Ilegible: no es un JWT que podamos juzgar, así que no lo rechazamos.
    return false;
  }
}

let memoizado: Entorno | null = null;

export function leerEntorno(): Entorno {
  if (memoizado) return memoizado;

  const url = obligatoria("SUPABASE_URL");
  const clave = obligatoria("SUPABASE_SERVICE_ROLE_KEY");

  // Salvaguarda barata contra el error más caro posible: arrancar con la
  // publishable key creyendo tener privilegios de administración. Las llamadas
  // a auth.admin fallarían con un 403 difícil de diagnosticar.
  //
  // Se aceptan los dos formatos vigentes: las claves nuevas (`sb_secret_...`) y
  // los JWT heredados de service_role, que empiezan por `eyJ`.
  if (!clave.startsWith("sb_secret_") && !clave.startsWith("eyJ")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY no parece una clave secreta.\n" +
        "Debe ser la Secret key (sb_secret_...) o la service_role key (JWT) del " +
        "proyecto, que están en Project Settings → API Keys. No uses la " +
        "publishable/anon key: no tiene privilegios de administración.",
    );
  }

  // La contraria de la salvaguarda anterior: aquí el error caro sería poner la
  // clave secreta donde va la pública, porque el login devolvería sesiones con
  // privilegios de administración al navegador.
  const clavePublica = obligatoria("SUPABASE_PUBLISHABLE_KEY");

  if (clavePublica.startsWith("sb_secret_") || esJwtDeServiceRole(clavePublica)) {
    throw new Error(
      "SUPABASE_PUBLISHABLE_KEY contiene una clave secreta.\n" +
        "Debe ser la Publishable key (sb_publishable_...) o la anon key (JWT), " +
        "la misma que usa el frontend en VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  memoizado = {
    supabaseUrl: url.replace(/\/+$/, ""),
    supabaseServiceRoleKey: clave,
    supabasePublishableKey: clavePublica,
    puerto: puerto(process.env.PORT),
    esProduccion: process.env.NODE_ENV === "production",
    origenesPermitidos: listaDeOrigenes(process.env.CORS_ORIGENES),
  };

  return memoizado;
}
