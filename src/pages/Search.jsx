import { Search as SearchIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import FactCard from "../components/FactCard.jsx";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import { supabase } from "../lib/supabaseClient.js";
import useFacts from "../hooks/useFacts.js";
import { PUBLIC_FACT_COLUMNS } from "../lib/facts.js";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const safeQuery = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  const tagQuery = safeQuery.toLowerCase().replace(/\s+/g, "-");
  const { data, loading, error } = useFacts(
    () => safeQuery
      ? supabase.from("facts").select(PUBLIC_FACT_COLUMNS).eq("verified", true).not("published_at", "is", null).or(`title.ilike.%${safeQuery}%,body.ilike.%${safeQuery}%,tags.cs.{${tagQuery}}`).order("likes", { ascending: false }).limit(60)
      : Promise.resolve({ data: [] }),
    [safeQuery],
  );

  function submit(event) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q")?.toString().trim();
    setParams(value ? { q: value } : {});
  }

  return (
    <main className="page-wrap page-content">
      <div className="page-intro"><span className="eyebrow">A WHOLE WORLD OF WONDER</span><h1>Follow the<br /><span>“what if?”</span></h1><p>Search across every subject. You never know what might turn up.</p></div>
      <form className="search-page-form" onSubmit={submit}><SearchIcon size={20} /><input name="q" defaultValue={query} aria-label="Search facts" placeholder="Try “octopus”, “the Moon”, “ancient Rome”…" /><button className="button button-dark" type="submit">Search</button></form>
      {query && <div className="search-result-label">Results for <strong>“{query}”</strong></div>}
      {error && <div className="notice notice-error">{error.message}</div>}
      {loading ? <LoadingSkeleton count={6} /> : query && data?.length ? <div className="fact-grid">{data.map((fact) => <FactCard key={fact.id} fact={fact} />)}</div> : query ? <div className="empty-panel"><span className="empty-icon">⌕</span><h2>No facts found for “{query}”</h2><p>Try a shorter search or a different keyword.</p></div> : <div className="empty-inline">Enter a word or topic to start exploring.</div>}
    </main>
  );
}
