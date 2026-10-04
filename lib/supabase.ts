import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error("Falta SUPABASE_URL en las variables de entorno");
}

if (!supabaseSecretKey) {
  throw new Error(
    "Falta SUPABASE_SECRET_KEY en las variables de entorno"
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey
);