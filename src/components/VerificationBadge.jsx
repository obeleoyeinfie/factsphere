import { BadgeCheck, CircleHelp, ShieldAlert } from "lucide-react";

export default function VerificationBadge({ status = "verified", confidence, compact = false }) {
  if (status === "verified") {
    return <span className={`verification-badge verified ${compact ? "compact" : ""}`} title={`Verified at source${Number.isFinite(confidence) ? ` · ${confidence}% confidence` : ""}`}><BadgeCheck size={14} />{compact ? "Verified" : `Verified at source${Number.isFinite(confidence) ? ` · ${confidence}%` : ""}`}</span>;
  }
  if (status === "disputed") {
    return <span className="verification-badge disputed"><ShieldAlert size={14} />Disputed</span>;
  }
  if (status === "partially_verified") {
    return <span className="verification-badge partial"><CircleHelp size={14} />Partially verified</span>;
  }
  return <span className="verification-badge pending"><CircleHelp size={14} />Unverified</span>;
}
