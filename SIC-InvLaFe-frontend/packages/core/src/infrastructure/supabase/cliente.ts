import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Adaptador de almacenamiento para la sesión.
 *
 * En web se usa `localStorage` (el predeterminado de supabase-js). En React
 * Native se inyecta AsyncStorage aquí, que es el único punto donde las dos
 * plataformas divergen.
 */
export interface AlmacenamientoSesion {
  getItem(clave: string): Promise<string | null> | string | null;
  setItem(clave: string, valor: string): Promise<void> | void;
  removeItem(clave: string): Promise<void> | void;
}

export interface ConfiguracionSupabase {
  url: string;
  /** Publishable key (`sb_publishable_...`) o anon key del proyecto. */
  publishableKey: string;
  almacenamiento?: AlmacenamientoSesion;
  /**
   * `false` en React Native: allí no hay URL del navegador de la que leer el
   * token del enlace de recuperación de contraseña.
   */
  detectarSesionEnUrl?: boolean;
}

export type ClienteSupabase = SupabaseClient;

export function crearClienteSupabase(
  config: ConfiguracionSupabase,
): ClienteSupabase {
  if (!config.url || !config.publishableKey) {
    throw new Error(
      "Faltan las credenciales de Supabase. Define VITE_SUPABASE_URL y " +
        "VITE_SUPABASE_PUBLISHABLE_KEY en el archivo .env de apps/web.",
    );
  }

  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: config.detectarSesionEnUrl ?? true,
      ...(config.almacenamiento ? { storage: config.almacenamiento } : {}),
    },
  });
}
