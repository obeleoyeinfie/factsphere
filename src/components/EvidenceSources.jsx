import { ArrowUpRight, BadgeCheck } from "lucide-react";

export default function EvidenceSources({ evidence = [], notes = "", checkedAt }) {
  const sources = Array.isArray(evidence) ? evidence : [];
  return (
    <section className="evidence-panel" aria-labelledby="evidence-title">
      <div className="evidence-heading"><BadgeCheck size={18} /><div><span className="eyebrow">TRANSPARENT BY DESIGN</span><h2 id="evidence-title">Evidence & verification</h2></div></div>
      {notes && <p className="evidence-notes">{notes}</p>}
      {sources.length ? <ul className="evidence-list">{sources.map((source, index) => (
        <li key={`${source.url}-${index}`}><div><strong>{source.name || source.domain || "Supporting source"}</strong><span>{source.supports ? "Supports this fact" : "Original source"}{source.independent === false ? " · same publisher" : ""}</span></div>{source.url && <a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open ${source.name || "source"}`}><ArrowUpRight size={16} /></a>}</li>
      ))}</ul> : <p className="empty-inline">No public evidence links are available for this fact.</p>}
      {checkedAt && <span className="evidence-checked">Last checked {new Date(checkedAt).toLocaleString()}</span>}
    </section>
  );
}
