import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getEnv } from "./env";

let client: SupabaseClient | undefined;

/**
 * Cliente de Supabase con la secret key: SOLO para uso en el servidor.
 *
 * Se crea al primer uso y no al importar el módulo: en modo demo
 * (sin upload real) las variables de Supabase pueden no existir, y un
 * import no debería romper el build ni otras rutas.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = getEnv();
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en las variables de entorno"
    );
  }

  client = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
  return client;
}
