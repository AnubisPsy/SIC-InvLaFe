/**
 * Lectura y validación de las variables de entorno.
 *
 * Se valida de forma perezosa, no al importar el módulo: si validáramos en el
 * ámbito del módulo, un `.env` ausente rompería la cadena de importaciones
 * antes del primer render y el límite de error —que solo captura errores de
 * render— nunca llegaría a mostrar qué falta configurar.
 */
export interface Entorno {
  supabaseUrl: string;
  supabasePublishableKey: string;
  /**
   * Backend administrativo. Solo lo usan las altas y bajas de usuarios, que
   * necesitan la service_role key de Supabase y no pueden hacerse desde el
   * navegador. El resto de la aplicación habla directamente con Supabase.
   */
  apiUrl: string;
  /** A dónde vuelve el usuario desde el enlace del correo de recuperación. */
  urlRestablecerContrasena: string;
}

function leer(nombre: string, valor: string | undefined): string {
  const limpio = valor?.trim();
  if (!limpio) {
    throw new Error(
      `Falta la variable de entorno ${nombre}.\n\n` +
        "Copia apps/web/.env.example a apps/web/.env y completa los valores " +
        "del proyecto de Supabase.",
    );
  }
  return limpio;
}

let memoizado: Entorno | null = null;

export function leerEntorno(): Entorno {
  if (memoizado) return memoizado;

  memoizado = {
    supabaseUrl: leer("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
    supabasePublishableKey: leer(
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    ),
    // Sin barra final: el cliente compone las rutas como `${apiUrl}/api/...`.
    apiUrl: leer("VITE_API_URL", import.meta.env.VITE_API_URL).replace(/\/+$/, ""),
    urlRestablecerContrasena: `${globalThis.location.origin}/restablecer-contrasena`,
  };

  return memoizado;
}
