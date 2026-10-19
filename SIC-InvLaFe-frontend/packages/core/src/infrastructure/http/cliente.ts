import {
  ErrorApp,
  ErrorAutenticacion,
  ErrorConflicto,
  ErrorInfraestructura,
  ErrorNoEncontrado,
  ErrorPermisoDenegado,
  ErrorValidacion,
  type CodigoError,
} from "../../shared/errores";
import type { ClienteSupabase } from "../supabase/cliente";

/**
 * Cliente HTTP del backend administrativo.
 *
 * Solo lo usan las escrituras sobre usuarios, que necesitan la `service_role`
 * key de Supabase y por eso no pueden hacerse desde el navegador. El resto de
 * la aplicación sigue hablando directamente con Supabase.
 *
 * Su trabajo es que el backend se vea desde el dominio exactamente igual que
 * PostgREST: devuelve datos o lanza un `ErrorApp`. Ningún caso de uso ni
 * componente sabe que hay un servidor de por medio.
 */
export interface ConfiguracionApi {
  /** URL base del backend, sin barra final. */
  urlBase: string;
}

export interface ClienteApi {
  solicitar<T>(ruta: string, opciones?: OpcionesSolicitud): Promise<T>;
}

export interface OpcionesSolicitud {
  metodo?: "GET" | "POST" | "PATCH" | "DELETE";
  cuerpo?: unknown;
  /** Descripción de la acción, para los mensajes de error. */
  contexto: string;
  /**
   * Envía la petición sin cabecera `Authorization`.
   *
   * Solo lo usa el login: es la única ruta de la API a la que se llama antes de
   * tener sesión, así que exigir token allí haría imposible obtenerlo.
   */
  sinSesion?: boolean;
}

/**
 * Declaración mínima de `fetch`.
 *
 * `@invlafe/core` compila con `lib: ["ES2022"]`, sin DOM, para garantizar que
 * no se cuele nada del navegador y el paquete siga sirviendo tal cual en React
 * Native. `fetch` es un estándar disponible en las dos plataformas, pero sus
 * tipos solo vienen en `lib.dom.d.ts`, así que se declara aquí lo que se usa y
 * nada más.
 *
 * Al ser declaraciones de ámbito de módulo, no chocan con las globales si algún
 * día se añadiera la librería DOM.
 */
interface RespuestaHttp {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

interface PeticionHttp {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

declare const fetch: (url: string, init: PeticionHttp) => Promise<RespuestaHttp>;

/** Forma del cuerpo de error que devuelve el backend. */
interface CuerpoError {
  error?: {
    codigo?: string;
    mensaje?: string;
    campos?: Record<string, string>;
  };
}

const CODIGOS: readonly CodigoError[] = [
  "VALIDACION",
  "NO_ENCONTRADO",
  "CONFLICTO",
  "PERMISO_DENEGADO",
  "AUTENTICACION",
  "INFRAESTRUCTURA",
];

function esCodigoConocido(valor: unknown): valor is CodigoError {
  return typeof valor === "string" && (CODIGOS as readonly string[]).includes(valor);
}

/**
 * Reconstruye el error del dominio a partir de la respuesta del backend.
 *
 * El backend usa los mismos códigos que `shared/errores.ts`, así que la
 * traducción es directa y la UI reacciona igual venga el fallo de Supabase o
 * del servidor: `ErrorValidacion` pinta los errores por campo,
 * `ErrorPermisoDenegado` explica que falta permiso, etc.
 */
function aErrorApp(estado: number, cuerpo: CuerpoError, contexto: string): ErrorApp {
  const detalle = cuerpo.error;
  const mensaje = detalle?.mensaje?.trim();
  const codigo = esCodigoConocido(detalle?.codigo) ? detalle.codigo : null;

  if (codigo === "VALIDACION") {
    return new ErrorValidacion(
      mensaje ?? "Revisa los datos enviados.",
      detalle?.campos ?? {},
    );
  }
  if (codigo === "AUTENTICACION") {
    return new ErrorAutenticacion(mensaje ?? "Tu sesión expiró. Vuelve a iniciar sesión.");
  }
  if (codigo === "PERMISO_DENEGADO") {
    return new ErrorPermisoDenegado(mensaje);
  }
  if (codigo === "NO_ENCONTRADO") {
    return new ErrorNoEncontrado(mensaje ?? "el registro");
  }
  if (codigo === "CONFLICTO") {
    return new ErrorConflicto(mensaje ?? `No se pudo ${contexto}.`);
  }

  // Sin código reconocible se decide por el estado HTTP: puede ser un proxy o
  // un balanceador respondiendo por su cuenta, no el backend.
  if (estado === 401) {
    return new ErrorAutenticacion("Tu sesión expiró. Vuelve a iniciar sesión.");
  }
  if (estado === 403) {
    return new ErrorPermisoDenegado(mensaje);
  }

  return new ErrorInfraestructura(mensaje ?? `No se pudo ${contexto}.`, {
    estado,
    cuerpo,
  });
}

/**
 * Construye el cliente.
 *
 * El token se lee de la sesión de Supabase en cada llamada, no se captura al
 * crear el cliente: supabase-js lo refresca por su cuenta y un token guardado
 * quedaría obsoleto en cuestión de una hora.
 */
export function crearClienteApi(
  config: ConfiguracionApi,
  supabase: ClienteSupabase,
): ClienteApi {
  const urlBase = config.urlBase.replace(/\/+$/, "");

  async function tokenDeSesion(): Promise<string> {
    const { data, error } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (error || !token) {
      throw new ErrorAutenticacion(
        "No hay una sesión activa. Vuelve a iniciar sesión.",
      );
    }
    return token;
  }

  return {
    async solicitar<T>(ruta: string, opciones: OpcionesSolicitud): Promise<T> {
      const { metodo = "GET", cuerpo, contexto, sinSesion = false } = opciones;
      const token = sinSesion ? null : await tokenDeSesion();

      let respuesta: RespuestaHttp;

      try {
        respuesta = await fetch(`${urlBase}${ruta}`, {
          method: metodo,
          headers: {
            ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
            ...(cuerpo === undefined ? {} : { "Content-Type": "application/json" }),
          },
          ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
        });
      } catch (fallo) {
        // `fetch` solo rechaza si la petición no llegó a hacerse: servidor
        // apagado, DNS, CORS o red caída. Es el caso que más desconcierta al
        // usuario, así que el mensaje dice qué hacer en vez de "Failed to fetch".
        throw new ErrorInfraestructura(
          `No se pudo conectar con el servidor para ${contexto}. ` +
            "Comprueba que el backend esté encendido e inténtalo de nuevo.",
          fallo,
        );
      }

      if (respuesta.status === 204) return undefined as T;

      let datos: unknown = null;

      try {
        datos = await respuesta.json();
      } catch {
        // Respuesta sin JSON: si venía bien, no había nada que leer; si venía
        // mal, el estado HTTP basta para construir el error.
        if (respuesta.ok) return undefined as T;
      }

      if (!respuesta.ok) {
        throw aErrorApp(respuesta.status, (datos ?? {}) as CuerpoError, contexto);
      }

      return datos as T;
    },
  };
}
