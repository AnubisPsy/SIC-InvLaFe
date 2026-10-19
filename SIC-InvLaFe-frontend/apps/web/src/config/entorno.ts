/**
 * Lectura y validación de las variables de entorno.
 *
 * Se valida de forma perezosa, no al importar el módulo: si validáramos en el
 * ámbito del módulo, un `.env` ausente rompería la cadena de importaciones
 * antes del primer render y el límite de error —que solo captura errores de
 * render— nunca llegaría a mostrar qué falta configurar.
 */
export interface Entorno {
  /** Dirección del backend, sin barra final. Toda la aplicación habla con él. */
  apiUrl: string;
}

function leer(nombre: string, valor: string | undefined): string {
  const limpio = valor?.trim();
  if (!limpio) {
    throw new Error(
      `Falta la variable de entorno ${nombre}.\n\n` +
        "Copia apps/web/.env.example a apps/web/.env y escribe la dirección del backend.",
    );
  }
  return limpio;
}

let memoizado: Entorno | null = null;

export function leerEntorno(): Entorno {
  if (memoizado) return memoizado;

  memoizado = {
    // Sin barra final: el cliente compone las rutas como `${apiUrl}/api/...`.
    // "/" queda vacío, y las rutas quedan relativas al mismo servidor (Docker).
    apiUrl: leer("VITE_API_URL", import.meta.env.VITE_API_URL).replace(/\/+$/, ""),
  };

  return memoizado;
}
