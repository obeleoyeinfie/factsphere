import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "../lib/supabaseClient.js";

function readableError(error) {
  const message = error?.message || String(error);
  if (
    (error?.code === "42703" || error?.code === "PGRST204")
    && /(verification_status|published_at|evidence_sources|confidence_score)/i.test(message)
  ) {
    return new Error(`Supabase needs the FactSphere migrations before it can load facts. Apply both SQL files in supabase/migrations, then refresh. Details: ${message}`);
  }
  return error instanceof Error ? error : new Error(message);
}

export default function useFacts(loader, dependencies = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) {
      setState({ data: null, loading: false, error: new Error("Connect Supabase to load FactSphere's live collection.") });
      return () => { active = false; };
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    Promise.resolve().then(loader).then(({ data, error }) => {
      if (!active) return;
      if (error) setState({ data: null, loading: false, error: readableError(error) });
      else setState({ data, loading: false, error: null });
    }).catch((error) => {
      if (active) setState({ data: null, loading: false, error: readableError(error) });
    });
    return () => { active = false; };
  }, dependencies);

  return state;
}
