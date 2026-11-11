import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCategoryImage, supabase } from "../lib/supabaseClient.js";
import { isFresh } from "../lib/facts.js";
import useFacts from "../hooks/useFacts.js";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import VerificationBadge from "../components/VerificationBadge.jsx";
import { PUBLIC_FACT_COLUMNS } from "../lib/facts.js";

function readShownIds() {
  try {
    const value = JSON.parse(sessionStorage.getItem("factsphere:shown") || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error("Could not read shuffle history.", error);
    return [];
  }
}

export default function Shuffle() {
  const { data: facts, loading, error } = useFacts(
    () => supabase.from("facts").select(PUBLIC_FACT_COLUMNS).eq("verified", true).not("published_at", "is", null).order("created_at", { ascending: false }).limit(1000),
    [],
  );
  const [shownIds, setShownIds] = useState(readShownIds);
  const [fact, setFact] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const remaining = facts?.filter((item) => !shownIds.includes(item.id)) || [];

  function pickNext(pool = remaining) {
    if (!pool.length) {
      setFact(null);
      return;
    }
    setTransitioning(true);
    window.setTimeout(() => {
      const next = pool[Math.floor(Math.random() * pool.length)];
      const nextShown = [...shownIds, next.id];
      setShownIds(nextShown);
      sessionStorage.setItem("factsphere:shown", JSON.stringify(nextShown));
      setFact(next);
      setImageUrl(next.image_url || getCategoryImage(next.category));
      setTransitioning(false);
    }, 170);
  }

  useEffect(() => {
    if (!fact && facts?.length) pickNext();
  }, [facts?.length]);

  if (loading) return <main className="page-wrap page-content"><LoadingSkeleton count={1} /></main>;
  return (
    <main className="shuffle-page">
      <div className="shuffle-top page-wrap"><span className="eyebrow"><Sparkles size={14} /> YOUR CURIOSITY, UNSCRIPTED</span><span>{remaining.length} {remaining.length === 1 ? "new fact" : "new facts"} left</span></div>
      {error && <div className="page-wrap"><div className="notice notice-error">{error.message}</div></div>}
      {fact ? <section className={`shuffle-card ${transitioning ? "is-transitioning" : ""}`}>
        <div className="shuffle-card-image">{imageUrl ? <img src={imageUrl} alt="" onError={() => setImageUrl(getCategoryImage(fact.category) === imageUrl ? "" : getCategoryImage(fact.category))} /> : <div className="image-placeholder">{fact.category}</div>}
          <span className="fact-category-pill">{fact.category}</span>{isFresh(fact.created_at) && <span className="fresh-pill">Fresh today</span>}
        </div>
        <div className="shuffle-card-copy"><span className="eyebrow">A FACT WORTH PAUSING FOR</span><VerificationBadge status={fact.verification_status} confidence={fact.confidence_score} /><h1>{fact.title}</h1><p>{fact.body}</p><div className="shuffle-source">{fact.source_name || "FactSphere"}{fact.source_url && <> · <a href={fact.source_url} target="_blank" rel="noreferrer">Read the source <ArrowRight size={13} /></a></>}</div>
          <button className="button button-dark shuffle-next" onClick={() => pickNext()} type="button" disabled={transitioning}>{remaining.length ? <>Next fact <ArrowRight size={17} /></> : "That was the last new fact"}</button>
          <Link className="shuffle-detail-link" to={`/fact/${fact.id}`}>Open fact details</Link>
        </div>
      </section> : <div className="page-wrap"><div className="empty-panel"><span className="empty-icon">✳</span><h2>{facts?.length ? "You’ve seen every fact." : "The next wonder is on its way."}</h2><p>{facts?.length ? "You’ve made it through the whole collection for this session. Come back after a little while for another discovery." : "Once editors approve the first facts, your shuffle starts here."}</p><Link className="button button-dark" to="/categories">Explore topics</Link></div></div>}
      <div className="shuffle-footer page-wrap"><span>NO REPEATS THIS SESSION</span><span>✳</span><Link to="/categories">Choose a topic instead <ArrowRight size={14} /></Link></div>
    </main>
  );
}
