import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import CategoryCard from "../components/CategoryCard.jsx";
import FactCard from "../components/FactCard.jsx";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import { CATEGORIES, dayOfYear, popularity, PUBLIC_FACT_COLUMNS } from "../lib/facts.js";
import { supabase } from "../lib/supabaseClient.js";
import useFacts from "../hooks/useFacts.js";

function FactGridSection({ title, eyebrow, facts, emptyText }) {
  return (
    <section className="content-section">
      <div className="section-heading"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><Link className="text-link" to="/categories">Explore topics <ArrowRight size={16} /></Link></div>
      {facts?.length ? <div className="fact-grid">{facts.map((fact) => <FactCard key={fact.id} fact={fact} />)}</div> : <div className="empty-inline">{emptyText}</div>}
    </section>
  );
}

export default function Home() {
  const { data: facts, loading, error } = useFacts(
    () => supabase.from("facts").select(PUBLIC_FACT_COLUMNS).eq("verified", true).not("published_at", "is", null).order("created_at", { ascending: false }).limit(1000),
    [],
  );
  const dailyFact = facts?.length ? [...facts].sort((a, b) => a.id.localeCompare(b.id))[dayOfYear() % facts.length] : null;
  const trending = facts ? [...facts].filter((fact) => Date.now() - new Date(fact.created_at).getTime() <= 7 * 86400000).sort((a, b) => popularity(b) - popularity(a)).slice(0, 3) : [];
  const recentFacts = facts ? [...facts].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3) : [];
  const freshFacts = facts ? facts.filter((fact) => Date.now() - new Date(fact.created_at).getTime() < 86400000).slice(0, 3) : [];
  const categoryCounts = Object.fromEntries(CATEGORIES.map((item) => [item.name, facts?.filter((fact) => fact.category === item.name).length || 0]));

  return (
    <main>
      <section className="hero page-wrap">
        <div className="hero-copy">
          <div className="hero-label"><span className="live-dot" /> THE INTERNET, DISTILLED</div>
          <h1>The world is<br /><span>more interesting</span><br />than you think.</h1>
          <p>Discover fascinating facts, explore unexpected knowledge, and learn something new every day.</p>
          <div className="hero-actions"><Link className="button button-dark" to="/random">Surprise me <Sparkles size={16} /></Link><Link className="button button-quiet" to="/categories">Browse topics <ArrowRight size={16} /></Link></div>
          <div className="hero-footnote"><span className="hero-avatar">✳</span><span>{facts?.length ? `${facts.length} verified discoveries to explore` : "A fresh perspective, one fact at a time"}</span></div>
        </div>
        <div className="hero-visual">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="visual-topline"><span>FACTSPHERE · VOL. 01</span><span>YOUR DAILY DOSE</span></div>
          <div className="visual-spark spark-one">✳</div><div className="visual-spark spark-two">✦</div><div className="visual-spark spark-three">✧</div>
          <div className="planet"><span className="planet-continent continent-one" /><span className="planet-continent continent-two" /><span className="planet-continent continent-three" /></div>
          <div className="visual-sticker"><span>✦</span><div><strong>Stay curious</strong><small>There’s always more to know.</small></div></div>
          <div className="visual-bottom"><Compass size={14} /> FACTS FROM EVERYWHERE</div>
        </div>
      </section>

      <div className="ticker" aria-label="Stay curious"><div>LOOK CLOSER <span>✳</span> ASK ONE MORE QUESTION <span>✳</span> THE WORLD IS FULL OF WONDER <span>✳</span> LOOK CLOSER <span>✳</span> ASK ONE MORE QUESTION <span>✳</span> THE WORLD IS FULL OF WONDER <span>✳</span></div></div>

      {error && <div className="page-wrap"><div className="notice notice-error">{error.message}</div></div>}
      {loading ? <section className="page-wrap content-section"><LoadingSkeleton count={3} /></section> : dailyFact && (
        <section className="daily-feature page-wrap">
          <div className="daily-feature-heading"><span className="eyebrow">YOUR LITTLE DAILY DETOUR</span><span className="daily-date">{new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric" }).format(new Date())}</span></div>
          <div className="daily-feature-body">
            <div className="daily-copy"><span className="daily-star">✳</span><span className="fact-category-text">{dailyFact.category}</span><h2>{dailyFact.title}</h2><p>{dailyFact.body}</p><Link to={`/fact/${dailyFact.id}`} className="text-link">Get the full story <ArrowRight size={16} /></Link></div>
            <FactCard fact={dailyFact} compact />
          </div>
        </section>
      )}

      {!loading && !error && !facts?.length && <section className="page-wrap collection-empty">
        <span className="collection-empty-mark"><Sparkles size={19} /></span>
        <div><span className="eyebrow">A NEW DISCOVERY IS ON ITS WAY</span><h2>Curiosity takes a moment.</h2><p>We publish facts only after their sources pass our checks. Explore a topic while the next verified discoveries are gathered.</p></div>
        <Link className="button button-quiet" to="/categories">Explore topics <ArrowRight size={15} /></Link>
      </section>}

      {loading ? <section className="page-wrap content-section"><LoadingSkeleton count={3} /></section> : facts?.length ? <FactGridSection title="The good stuff" eyebrow="TRENDING · LAST 7 DAYS" facts={trending} emptyText="Verified trending facts will appear here as soon as the pipeline publishes its first batch." /> : null}

      {!loading && recentFacts.length > 0 && <FactGridSection title="Just discovered" eyebrow="FRESH FROM THE SPHERE" facts={recentFacts} emptyText="New verified facts will appear here." />}
      {!loading && freshFacts.length > 0 && <FactGridSection title="Fresh today" eyebrow="LESS THAN 24 HOURS OLD" facts={freshFacts} emptyText="No fresh facts yet today." />}

      <section className="topics-section">
        <div className="page-wrap">
          <div className="section-heading"><div><span className="eyebrow">PICK A PATH</span><h2>Follow your curiosity.</h2></div><Link className="text-link" to="/categories">All 16 topics <ArrowRight size={16} /></Link></div>
          {loading ? <LoadingSkeleton count={8} variant="category" /> : <div className="category-grid">{CATEGORIES.map((category) => <CategoryCard key={category.name} category={category} count={categoryCounts[category.name]} />)}</div>}
        </div>
      </section>
    </main>
  );
}
