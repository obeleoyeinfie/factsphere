import { ArrowLeft, ArrowUpRight, Eye, Flag, Heart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import FactCard from "../components/FactCard.jsx";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import ReportModal from "../components/ReportModal.jsx";
import ShareButtons from "../components/ShareButtons.jsx";
import useFavorites from "../hooks/useFavorites.js";
import useFacts from "../hooks/useFacts.js";
import { popularity, PUBLIC_FACT_COLUMNS } from "../lib/facts.js";
import { getCategoryImage, supabase } from "../lib/supabaseClient.js";
import EvidenceSources from "../components/EvidenceSources.jsx";
import VerificationBadge from "../components/VerificationBadge.jsx";

export default function FactDetail() {
  const { id } = useParams();
  const [reportOpen, setReportOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const { data: fact, loading, error } = useFacts(
    () => supabase.from("facts").select(PUBLIC_FACT_COLUMNS).eq("id", id).eq("verified", true).not("published_at", "is", null).maybeSingle(),
    [id],
  );
  const { data: related = [] } = useFacts(
    () => fact
      ? supabase.from("facts").select(PUBLIC_FACT_COLUMNS).eq("verified", true).not("published_at", "is", null).neq("id", id).limit(250)
      : Promise.resolve({ data: [] }),
    [id, fact?.id],
  );
  const favorite = useFavorites(id);
  const viewRequest = useRef(null);
  const [views, setViews] = useState(null);

  useEffect(() => {
    if (!fact) return;
    setImageUrl(fact.image_url || getCategoryImage(fact.category));
    setViews(Number(fact.views || 0));
    const previousTitle = document.title;
    const description = document.querySelector('meta[name="description"]');
    const previousDescription = description?.getAttribute("content") || "";
    document.title = `${fact.title} | FactSphere`;
    description?.setAttribute("content", fact.body);
    let active = true;
    if (!viewRequest.current || viewRequest.current.factId !== fact.id) {
      viewRequest.current = { factId: fact.id, promise: supabase.rpc("increment_views", { fact_id: fact.id }) };
    }
    viewRequest.current.promise.then(({ data, error: rpcError }) => {
      if (rpcError) {
        if (active) console.error("Could not increment the fact view count.", rpcError);
        return;
      }
      if (active && typeof data === "number") setViews(data);
    });
    return () => {
      active = false;
      document.title = previousTitle;
      description?.setAttribute("content", previousDescription);
    };
  }, [fact?.id]);

  if (loading) return <main className="page-wrap page-content"><LoadingSkeleton count={1} /></main>;
  if (error || !fact) return <main className="page-wrap page-content"><div className="empty-panel"><span className="eyebrow">{error ? "WE HIT A SNAG" : "404 · FACT NOT FOUND"}</span><h1>{error ? "Couldn’t load that fact." : "This fact has wandered off."}</h1><p>{error?.message || "It may have been removed or not approved yet."}</p><Link className="button button-dark" to="/">Back to discovery</Link></div></main>;

  const relatedFacts = [...related].map((item) => {
    const sharedTags = item.tags?.filter((tag) => fact.tags?.includes(tag)).length || 0;
    return { ...item, relatedScore: (item.category === fact.category ? 3 : 0) + sharedTags * 2 + popularity(item) };
  }).sort((a, b) => b.relatedScore - a.relatedScore).slice(0, 3);
  const imageAttributionUrl = fact.image_attribution?.match(/https?:\/\/\S+$/)?.[0];
  const imageAttributionText = imageAttributionUrl
    ? fact.image_attribution.replace(/\s·\shttps?:\/\/\S+$/, "")
    : fact.image_attribution;

  function onImageError() {
    const fallback = getCategoryImage(fact.category);
    if (fallback && imageUrl !== fallback) setImageUrl(fallback);
    else setImageUrl("");
  }

  return (
    <main className="page-wrap page-content">
      <Link to={-1} className="back-link"><ArrowLeft size={15} /> Back</Link>
      <article className="detail-layout">
        <div className="detail-main">
          <div className="detail-image">{imageUrl ? <img src={imageUrl} alt="" onError={onImageError} /> : <div className="image-placeholder">{fact.category}</div>}
            <span className="fact-category-pill">{fact.category}</span>
            {fact.created_at && Date.now() - new Date(fact.created_at).getTime() < 86400000 && <span className="fresh-pill">Fresh today</span>}
          </div>
          <div className="detail-overline"><span>{fact.source_name || "FactSphere"}</span><span><Eye size={15} /> {(views ?? Number(fact.views || 0)).toLocaleString()} reads</span></div>
          <h1 className="detail-title">{fact.title}</h1>
          <VerificationBadge status={fact.verification_status} confidence={fact.confidence_score} />
          <p className="detail-body">{fact.body}</p>
          {fact.source_url && <a className="source-link" href={fact.source_url} target="_blank" rel="noreferrer">Source: {fact.source_name || "Original source"} <ArrowUpRight size={15} /></a>}
          {fact.discussion_url && fact.discussion_url !== fact.source_url && <a className="source-link" href={fact.discussion_url} target="_blank" rel="noreferrer">Join the Reddit discussion <ArrowUpRight size={15} /></a>}
          {(fact.image_attribution || fact.image_license) && <p className="image-attribution">Image: {imageAttributionText || "Source attribution unavailable"}{imageAttributionUrl && <> · <a href={imageAttributionUrl} target="_blank" rel="noreferrer">Attribution details</a></>}{fact.image_license ? ` · ${fact.image_license}` : ""}</p>}
          <div className="detail-actions">
            <button type="button" className={`button like-detail ${favorite.liked ? "liked" : ""}`} onClick={favorite.toggle}><Heart size={17} fill={favorite.liked ? "currentColor" : "none"} /> {favorite.liked ? "Saved to favorites" : "Like this fact"} · {Math.max(Number(fact.likes || 0), favorite.registeredCount || 0)}</button>
            <button type="button" className="button button-quiet" onClick={() => setReportOpen(true)}><Flag size={16} /> Report this fact</button>
          </div>
          {favorite.error && <p className="inline-error">{favorite.error}</p>}
          <ShareButtons title={fact.title} />
          <EvidenceSources evidence={fact.evidence_sources} notes={fact.verification_notes} checkedAt={fact.verification_checked_at} />
        </div>
        <aside className="detail-aside"><div className="aside-note"><span className="eyebrow">A THOUGHT TO KEEP</span><p>Curiosity looks good on you.</p><span className="aside-spark">✳</span></div><div className="fact-source-box"><span className="eyebrow">IN THIS STORY</span><div><span>Category</span><strong>{fact.category}</strong></div><div><span>Published</span><strong>{new Date(fact.created_at).toLocaleDateString()}</strong></div><div><span>Community love</span><strong>{Number(fact.likes || 0).toLocaleString()} likes</strong></div></div></aside>
      </article>
      {relatedFacts.length > 0 && <section className="content-section related-section"><div className="section-heading"><div><span className="eyebrow">KEEP THE CURIOSITY GOING</span><h2>You might also like.</h2></div></div><div className="fact-grid">{relatedFacts.map((item) => <FactCard key={item.id} fact={item} />)}</div></section>}
      {reportOpen && createPortal(<ReportModal factId={fact.id} onClose={() => setReportOpen(false)} />, document.body)}
    </main>
  );
}
