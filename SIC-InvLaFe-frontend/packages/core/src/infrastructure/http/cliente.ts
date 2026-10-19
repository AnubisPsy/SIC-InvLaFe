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
import type { AlmacenSesion } from "./sesion";

/**
 * Cliente HTTP del backend.
 *
 * Toda la aplicación habla con el backend a través de él. Devuelve datos o
 * lanza un `ErrorApp`, así que ningún caso de uso ni componente necesita
 * saber que hay un servidor de por medio.
 */
export interface ConfiguracionApi {
  /** URL base del backend, sin barra final. */
  urlBase: string;
}

export interface ClienteApi {
  solicitar<T>(ruta: string, opciones?: OpcionesSolicitud): Promise<T>;
}

export interface OpcionesSolicitud {
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
 * traducción es directa y la UI reacciona igual ante cualquier fallo
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
 * El token se lee de la sesión guardada en cada llamada. Si el backend
 * responde 401 (token vencido o usuario desactivado), se borra la sesión: eso
 * avisa a la aplicación, que manda al usuario al login.
 */
export function crearClienteApi(
  config: ConfiguracionApi,
  sesion: AlmacenSesion,
): ClienteApi {
  const urlBase = config.urlBase.replace(/\/+$/, "");

  async function tokenDeSesion(): Promise<string> {
    const guardada = await sesion.leer();
    if (!guardada) {
      throw new ErrorAutenticacion("No hay una sesión activa. Vuelve a iniciar sesión.");
    }
    return guardada.token;
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
        // apagado, DNS, CORS o red caída.
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
        if (respuesta.ok) return undefined as T;
      }

      if (!respuesta.ok) {
        // Un 401 con token significa que la sesión ya no vale.
        if (respuesta.status === 401 && token !== null) await sesion.borrar();
        throw aErrorApp(respuesta.status, (datos ?? {}) as CuerpoError, contexto);
      }

      return datos as T;
    },
  };
}
