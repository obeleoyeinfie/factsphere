import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getCategoryImage(category = "Science") {
  const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return supabaseUrl
    ? `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/category-defaults/${slug}.jpg`
    : "";
}
