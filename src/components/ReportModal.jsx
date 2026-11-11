import { X } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient.js";

export default function ReportModal({ factId, onClose }) {
  const [reasonType, setReasonType] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState({ loading: false, error: "", sent: false });

  async function submit(event) {
    event.preventDefault();
    if (!reasonType) return;
    setStatus({ loading: true, error: "", sent: false });
    const reason = reasonType === "Other" ? details.trim() : reasonType;
    if (reason.length < 3 || reason.length > 500) {
      setStatus({ loading: false, error: "Please describe the issue in 3–500 characters.", sent: false });
      return;
    }
    const { error } = await supabase.rpc("report_fact", { fact_id: factId, reason });
    if (error) {
      console.error("Could not submit fact report.", error);
      setStatus({ loading: false, error: `Your report could not be sent: ${error.message}`, sent: false });
      return;
    }
    setStatus({ loading: false, error: "", sent: true });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-title" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}>
        <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Close report dialog"><X size={20} /></button>
        {status.sent ? (
          <div className="report-success"><span className="success-icon">✓</span><h2 id="report-title">Thanks for the heads-up.</h2><p>Your report has been added to the fact investigation queue.</p><button className="button button-dark" onClick={onClose}>Done</button></div>
        ) : (
          <form onSubmit={submit}>
            <span className="eyebrow">Help us keep it factual</span>
            <h2 id="report-title">What seems off?</h2>
            <p>Tell the FactSphere team why this fact should be investigated.</p>
            <select className="report-reason-select" aria-label="Reason for report" value={reasonType} onChange={(event) => setReasonType(event.target.value)} required>
              <option value="">Choose a reason…</option>
              <option value="Fact appears incorrect">Fact appears incorrect</option>
              <option value="Outdated information">Outdated information</option>
              <option value="Misleading description">Misleading description</option>
              <option value="Broken source">Broken source</option>
              <option value="Other">Other</option>
            </select>
            {reasonType === "Other" && <textarea required minLength={3} maxLength={500} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Tell us what seems wrong…" />}
            {status.error && <p className="form-error" role="alert">{status.error}</p>}
            <button className="button button-dark" type="submit" disabled={status.loading}>{status.loading ? "Sending…" : "Send report"}</button>
          </form>
        )}
      </motion.section>
    </div>
  );
}
