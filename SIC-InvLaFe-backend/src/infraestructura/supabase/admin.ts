import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { leerEntorno } from "../../config/entorno.js";

/**
 * Cliente de Supabase con la service_role key.
 *
 * **Ignora RLS por completo.** Cualquier consulta hecha con él ve y modifica
 * todas las filas, así que la autorización no puede delegarse en la base: la
 * hacen los middleware de este backend antes de llegar aquí.
 *
 * `persistSession: false` y `autoRefreshToken: false` porque el servidor no
 * tiene una sesión de usuario que mantener; cada petición trae la suya.
 */
export type ClienteAdmin = SupabaseClient;

let clienteAdmin: ClienteAdmin | null = null;

export function obtenerClienteAdmin(): ClienteAdmin {
  if (clienteAdmin) return clienteAdmin;

  const entorno = leerEntorno();

  clienteAdmin = createClient(entorno.supabaseUrl, entorno.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return clienteAdmin;
}
