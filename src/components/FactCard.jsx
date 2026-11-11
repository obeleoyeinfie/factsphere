import { ArrowUpRight, Flag, Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import { getCategoryImage } from "../lib/supabaseClient.js";
import { isFresh } from "../lib/facts.js";
import useFavorites from "../hooks/useFavorites.js";
import ReportModal from "./ReportModal.jsx";
import VerificationBadge from "./VerificationBadge.jsx";

export default function FactCard({ fact, compact = false }) {
  const { liked, toggle, error, registeredCount } = useFavorites(fact.id);
  const [imageUrl, setImageUrl] = useState(fact.image_url || getCategoryImage(fact.category));
  const [imageFailed, setImageFailed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  function onImageError() {
    const fallback = getCategoryImage(fact.category);
    if (!imageFailed && fallback && imageUrl !== fallback) {
      setImageFailed(true);
      setImageUrl(fallback);
      return;
    }
    setImageUrl("");
  }

  return (
    <motion.article className={`fact-card ${compact ? "fact-card-compact" : ""}`} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.35 }}>
      <Link to={`/fact/${fact.id}`} className="fact-card-image" aria-label={`Read ${fact.title}`}>
        {imageUrl ? <img src={imageUrl} alt="" loading="lazy" onError={onImageError} /> : <div className="image-placeholder" aria-hidden="true">{fact.category}</div>}
        <span className="fact-category-pill">{fact.category}</span>
        {isFresh(fact.created_at) && <span className="fresh-pill">Fresh today</span>}
        <span className="image-arrow"><ArrowUpRight size={18} /></span>
      </Link>
      <div className="fact-card-content">
        <div className="fact-card-meta"><span>{fact.source_name || "FactSphere"}</span><span>{Number(fact.views || 0).toLocaleString()} reads</span></div>
        <VerificationBadge status={fact.verification_status || "verified"} confidence={fact.confidence_score} compact />
        <Link to={`/fact/${fact.id}`} className="fact-card-title"><h3>{fact.title}</h3></Link>
        {!compact && <p>{fact.body}</p>}
        <div className="fact-card-footer">
          <span className="fact-card-tag">{fact.tags?.[0]?.replace(/-/g, " ") || fact.category}</span>
          <button className={`like-button ${liked ? "liked" : ""}`} type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(); }} aria-label={liked ? "Remove from favorites" : "Like fact"} aria-pressed={liked}>
            <Heart size={16} fill={liked ? "currentColor" : "none"} />
            <span>{Math.max(Number(fact.likes || 0), registeredCount || 0)}</span>
          </button>
          <button className="report-card-button" type="button" onClick={() => setReportOpen(true)} aria-label="Report this fact"><Flag size={14} /></button>
        </div>
        {error && <span className="inline-error" role="status">{error}</span>}
      </div>
      {reportOpen && createPortal(<ReportModal factId={fact.id} onClose={() => setReportOpen(false)} />, document.body)}
    </motion.article>
  );
}
