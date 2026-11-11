import { Copy, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";

export default function ShareButtons({ title }) {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;
  const encodedTitle = encodeURIComponent(title);
  const encodedUrl = encodeURIComponent(url);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      console.error("Could not copy the share link.", error);
      window.prompt("Copy this link to share:", url);
    }
  }

  return (
    <div className="share-buttons" aria-label="Share this fact">
      <span><Share2 size={15} /> Share</span>
      <button type="button" onClick={copyLink} aria-label="Copy link"><Copy size={16} />{copied ? "Copied" : "Copy link"}</button>
      <a href={`https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`} target="_blank" rel="noreferrer"><span className="x-share-mark">𝕏</span> Post</a>
      <a href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
    </div>
  );
}
