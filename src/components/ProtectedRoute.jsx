import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";

export default function ProtectedRoute({ children }) {
  const [sessionState, setSessionState] = useState({ loading: true, session: null });

  useEffect(() => {
    if (!supabase) {
      setSessionState({ loading: false, session: null });
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(async ({ data, error }) => {
      if (error) console.error("Could not read the admin session.", error);
      const session = data?.session ?? null;
      if (!session) {
        if (active) setSessionState({ loading: false, session: null, isAdmin: false });
        return;
      }
      const { data: adminRecord, error: adminError } = await supabase.from("admin_users")
        .select("id").eq("id", session.user.id).maybeSingle();
      if (adminError) console.error("Could not verify the administrator role.", adminError);
      if (active) setSessionState({
        loading: false,
        session: adminError ? null : session,
        isAdmin: Boolean(adminRecord),
        error: adminError?.message || "",
      });
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionState({ loading: true, session, isAdmin: false });
      if (session) {
        supabase.from("admin_users").select("id").eq("id", session.user.id).maybeSingle()
          .then(({ data, error }) => {
            if (error) console.error("Could not verify the administrator role.", error);
            setSessionState({
              loading: false,
              session: error || !data ? null : session,
              isAdmin: Boolean(data),
              error: error?.message || "",
            });
          });
      } else {
        setSessionState({ loading: false, session: null, isAdmin: false });
      }
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (sessionState.loading) return <div className="page-loading"><span className="spinner" /> Checking your session…</div>;
  if (sessionState.error) return <main className="page-wrap page-content"><div className="notice notice-error" role="alert">Could not verify administrator access. Confirm that the Supabase migrations are applied and try again. Details: {sessionState.error}</div></main>;
  if (!sessionState.session || !sessionState.isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
}
