import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FactCard from "../components/FactCard.jsx";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import { getFavoriteIds } from "../lib/facts.js";
import { supabase } from "../lib/supabaseClient.js";
import useFacts from "../hooks/useFacts.js";
import { PUBLIC_FACT_COLUMNS } from "../lib/facts.js";

export default function Favorites() {
  const [ids, setIds] = useState(getFavoriteIds);
  useEffect(() => {
    const update = (event) => setIds(event.detail || getFavoriteIds());
    window.addEventListener("factsphere:favorites-changed", update);
    return () => window.removeEventListener("factsphere:favorites-changed", update);
  }, []);
  const key = ids.join(",");
  const { data, loading, error } = useFacts(
    () => ids.length ? supabase.from("facts").select(PUBLIC_FACT_COLUMNS).eq("verified", true).not("published_at", "is", null).in("id", ids) : Promise.resolve({ data: [] }),
    [key],
  );
  const facts = data ? [...data].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)) : [];

  return (
    <main className="page-wrap page-content">
      <div className="page-intro"><span className="eyebrow">YOUR PERSONAL LITTLE LIBRARY</span><h1>Good things<br /><span>worth keeping.</span></h1><p>All the curious bits you’ve tucked away, together in one place.</p></div>
      {error && <div className="notice notice-error">{error.message}</div>}
      {loading ? <LoadingSkeleton count={3} /> : facts.length ? <div className="fact-grid">{facts.map((fact) => <FactCard key={fact.id} fact={fact} />)}</div> : <div className="empty-panel"><span className="empty-icon">♡</span><h2>Nothing tucked away. Yet.</h2><p>When a fact makes you smile, tap the heart to keep it close.</p><Link className="button button-dark" to="/">Find a little wonder</Link></div>}
    </main>
  );
}
