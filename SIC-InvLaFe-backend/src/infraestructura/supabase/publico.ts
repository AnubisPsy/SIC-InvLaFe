import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { leerEntorno } from "../../config/entorno.js";

/**
 * Cliente de Supabase con la publishable key: los mismos privilegios que tiene
 * el navegador, ni uno más. **Respeta RLS.**
 *
 * Solo lo usa el login por nombre de usuario. La traducción nombre → correo se
 * hace con el cliente de administración (que sí ignora RLS), pero la
 * autenticación en sí pasa por aquí para que la sesión emitida sea idéntica a
 * la que habría obtenido el navegador entrando por su cuenta.
 *
 * A diferencia de `obtenerClienteAdmin`, **no se memoiza**: `signInWithPassword`
 * deja la sesión recién creada dentro del cliente, y un cliente compartido entre
 * peticiones concurrentes podría acabar mezclando la sesión de una persona con
 * la petición de otra. Crear uno por login es barato y elimina la duda.
 */
export function crearClientePublico(): SupabaseClient {
  const entorno = leerEntorno();

  return createClient(entorno.supabaseUrl, entorno.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
