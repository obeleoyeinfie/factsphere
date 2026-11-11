import { ArrowUpRight, BookOpen, HeartHandshake, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const sources = [
  ["Wikipedia", "Encyclopedic context and curious discoveries", "https://www.wikipedia.org/"],
  ["Reddit · r/todayilearned", "Community-shared things worth knowing", "https://www.reddit.com/r/todayilearned/"],
  ["Numbers API", "Stories hidden inside numbers", "https://numbersapi.com/"],
  ["REST Countries", "Country facts and geographic details", "https://restcountries.com/"],
  ["Wikimedia Commons", "Openly licensed imagery for the curious", "https://commons.wikimedia.org/"],
  ["Unsplash", "Beautiful images from a global creator community", "https://unsplash.com/"],
];

export default function About() {
  return (
    <main className="page-wrap page-content about-page">
      <div className="about-hero"><span className="eyebrow">A NOTE FROM THE CURIOUS</span><h1>Curiosity is<br /><span>a way of life.</span></h1><p>FactSphere is a tiny corner of the internet for people who still stop to wonder.</p><span className="about-orbit">✳</span></div>
      <div className="about-grid"><section className="about-story"><span className="eyebrow">WHY WE’RE HERE</span><h2>Small discoveries.<br />A bigger world.</h2><p>We collect the curious, the surprising, and the quietly extraordinary details that make this world such a fascinating place to be. No lectures, no endless scroll. Just short, thoughtful facts to brighten your day and give your conversations a little extra spark.</p><p>Facts are checked against their original source and independent references before they can be published. Our automated confidence score is a research aid, not a guarantee of truth; each fact keeps its source and available evidence close by. Take what catches your eye. Save what stays with you. And never stop asking “why?”</p><Link className="button button-dark" to="/random">Find your next wonder <Sparkles size={16} /></Link></section><aside className="about-quote"><BookOpen size={22} /><blockquote>“The world is full of obvious things which nobody by any chance ever observes.”</blockquote><span>— SHERLOCK HOLMES (A FRIENDLY REMINDER)</span></aside></div>
      <section className="sources-section"><div className="section-heading"><div><span className="eyebrow">GOOD THINGS COME FROM GOOD SOURCES</span><h2>Where facts begin.</h2></div><HeartHandshake size={27} /></div><div className="source-grid">{sources.map(([name, description, url]) => <a key={name} href={url} target="_blank" rel="noreferrer" className="source-card"><strong>{name}<ArrowUpRight size={15} /></strong><span>{description}</span></a>)}</div><p className="source-note">Images and facts retain links to their original sources. We’re grateful to the communities and organizations that make this shared knowledge possible. Verification uses deterministic text and source heuristics and can make mistakes; evidence is shown so readers can check original references.</p></section>
    </main>
  );
}
