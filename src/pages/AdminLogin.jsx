import { useState } from "react";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient.js";

export default function AdminLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [status, setStatus] = useState({ loading: false, error: "" });
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    if (!supabase) {
      setStatus({ loading: false, error: "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before signing in." });
      return;
    }
    setStatus({ loading: true, error: "" });
    const { data, error } = await supabase.auth.signInWithPassword(form);
    if (error) {
      console.error("Admin sign-in failed.", error);
      setStatus({ loading: false, error: error.message });
      return;
    }
    const { data: adminRecord, error: adminError } = await supabase.from("admin_users")
      .select("id").eq("id", data.user.id).maybeSingle();
    if (adminError || !adminRecord) {
      await supabase.auth.signOut();
      setStatus({ loading: false, error: adminError?.message || "This account does not have the admin role." });
      return;
    }
    navigate("/admin", { replace: true });
  }

  return (
    <main className="page-wrap page-content login-page">
      <Link to="/" className="back-link"><ArrowLeft size={15} /> Back to FactSphere</Link>
      <div className="login-card"><div className="login-icon"><LockKeyhole size={22} /></div><span className="eyebrow">THE FACT MONITOR</span><h1>Welcome back.</h1><p>Sign in with your FactSphere admin account to investigate verification and community reports.</p>
        {!isSupabaseConfigured && <div className="notice notice-error">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect this app.</div>}
        <form onSubmit={submit}><label>Email<input type="email" autoComplete="username" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Password<input type="password" autoComplete="current-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {status.error && <div className="form-error" role="alert">{status.error}</div>}
          <button type="submit" className="button button-dark" disabled={status.loading || !isSupabaseConfigured}>{status.loading ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </main>
  );
}
