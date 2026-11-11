import { AlertTriangle, BadgeCheck, CircleHelp, Clock3, Eye, LogOut, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VerificationBadge from "../components/VerificationBadge.jsx";
import { supabase } from "../lib/supabaseClient.js";

const EMPTY_COUNTS = { total: 0, verified: 0, pending: 0, disputed: 0, rejected: 0, reports: 0 };

export default function Admin() {
  const [facts, setFacts] = useState([]);
  const [historyByFact, setHistoryByFact] = useState({});
  const [reports, setReports] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [drafts, setDrafts] = useState({});
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [factResult, reportResult, runResult, ...countResults] = await Promise.all([
      supabase.from("facts").select("*").order("verification_checked_at", { ascending: false, nullsFirst: true }).limit(200),
      supabase.from("reports").select("id, fact_id, reason, created_at, facts(id, title, category, verification_status)").order("created_at", { ascending: false }).limit(100),
      supabase.from("pipeline_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("facts").select("id", { count: "exact", head: true }),
      supabase.from("facts").select("id", { count: "exact", head: true }).eq("verified", true),
      supabase.from("facts").select("id", { count: "exact", head: true }).in("verification_status", ["unverified", "partially_verified"]),
      supabase.from("facts").select("id", { count: "exact", head: true }).eq("verification_status", "disputed"),
      supabase.from("facts").select("id", { count: "exact", head: true }).eq("verification_status", "rejected"),
      supabase.from("reports").select("id", { count: "exact", head: true }),
    ]);
    let verificationHistory = [];
    let historyError = null;
    if (!factResult.error && factResult.data?.length) {
      const historyResult = await supabase.from("verification_history")
        .select("fact_id, previous_status, new_status, confidence_score, created_at")
        .in("fact_id", factResult.data.map((fact) => fact.id))
        .order("created_at", { ascending: false })
        .limit(1000);
      verificationHistory = historyResult.data || [];
      historyError = historyResult.error;
    }
    const requestError = factResult.error || reportResult.error || runResult.error || historyError || countResults.find((result) => result.error)?.error;
    if (requestError) {
      console.error("Could not load FactSphere monitoring data.", requestError);
      setError(requestError.message);
    } else {
      setFacts(factResult.data || []);
      setHistoryByFact(verificationHistory.reduce((groups, item) => {
        groups[item.fact_id] = [...(groups[item.fact_id] || []), item];
        return groups;
      }, {}));
      setReports(reportResult.data || []);
      setLastRun(runResult.data || null);
      setCounts({
        total: countResults[0].count || 0,
        verified: countResults[1].count || 0,
        pending: countResults[2].count || 0,
        disputed: countResults[3].count || 0,
        rejected: countResults[4].count || 0,
        reports: countResults[5].count || 0,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function reverify(factId = null) {
    setBusyId(factId || "all");
    setError("");
    setNotice("");
    const { data, error: invokeError } = await supabase.functions.invoke("reverify-facts", {
      body: factId ? { fact_id: factId } : {},
    });
    if (invokeError) {
      console.error("Could not start fact re-verification.", invokeError);
      setError(invokeError.message);
    } else {
      setNotice(factId ? "Re-verification completed for the selected fact." : `Re-verification completed. ${data?.verified || 0} facts remain verified.`);
      await load();
    }
    setBusyId("");
  }

  async function updateFact(fact, changes, message) {
    setBusyId(fact.id);
    setError("");
    const { error: updateError } = await supabase.from("facts").update(changes).eq("id", fact.id);
    if (updateError) {
      console.error("Could not update fact.", updateError);
      setError(updateError.message);
      setBusyId("");
      return false;
    } else {
      setNotice(message);
      await load();
    }
    setBusyId("");
    return true;
  }

  async function saveCorrection(fact) {
    const body = (drafts[fact.id] ?? fact.body).trim();
    if (body.length < 40 || body.length > 300) {
      setError("Fact descriptions must contain 40–300 characters.");
      return;
    }
    const saved = await updateFact(fact, {
      body,
      verified: false,
      published_at: null,
      verification_status: "unverified",
      verification_notes: "Description corrected by an administrator; awaiting automated re-verification.",
    }, "Correction saved and temporarily withdrawn pending re-verification.");
    if (saved) await reverify(fact.id);
  }

  async function signOut() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.error("Could not sign out.", signOutError);
      setError(signOutError.message);
    }
  }

  const nextRun = lastRun?.started_at
    ? new Date(new Date(lastRun.started_at).getTime() + (lastRun.function_name === "reverify-facts" ? 24 : 6) * 3600000)
    : null;

  return (
    <main className="page-wrap page-content admin-page">
      <div className="admin-heading">
        <div><span className="eyebrow">AUTOMATED ACCURACY MONITOR</span><h1>Knowledge,<br /><span>under the lens.</span></h1><p>FactSphere publishes automatically when the evidence clears its confidence threshold. You’re here to monitor, investigate, and correct.</p></div>
        <div className="admin-actions"><button className="button button-quiet" onClick={load} type="button"><RefreshCw size={16} /> Refresh</button><button className="button button-quiet" onClick={signOut} type="button"><LogOut size={16} /> Sign out</button></div>
      </div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className="notice notice-success" role="status">{notice}</div>}

      <section className="admin-stats" aria-label="Platform overview">
        {[
          ["Collected", counts.total, <Sparkles size={17} />],
          ["Verified & live", counts.verified, <BadgeCheck size={17} />],
          ["Awaiting evidence", counts.pending, <CircleHelp size={17} />],
          ["Disputed", counts.disputed, <ShieldAlert size={17} />],
          ["Rejected", counts.rejected, <AlertTriangle size={17} />],
          ["Reports", counts.reports, <Eye size={17} />],
        ].map(([label, count, icon]) => <div className="admin-stat glass-card" key={label}><span>{icon}{label}</span><strong>{count}</strong></div>)}
      </section>

      <section className="admin-section pipeline-health">
        <div className="admin-section-heading"><div><span className="eyebrow">SCHEDULED PIPELINES</span><h2>Pipeline health</h2></div><button className="button button-dark" disabled={busyId !== ""} onClick={() => reverify()}><RefreshCw size={15} /> {busyId === "all" ? "Checking…" : "Re-verify due facts"}</button></div>
        <div className="pipeline-summary glass-card">
          <div><Clock3 size={17} /><span>Last execution</span><strong>{lastRun?.started_at ? new Date(lastRun.started_at).toLocaleString() : "No runs recorded yet"}</strong></div>
          <div><Sparkles size={17} /><span>Latest job</span><strong>{lastRun ? `${lastRun.function_name} · ${lastRun.status}` : "Waiting for first run"}</strong></div>
          <div><BadgeCheck size={17} /><span>Verified on last run</span><strong>{lastRun?.facts_verified ?? "—"}</strong></div>
          <div><AlertTriangle size={17} /><span>API / verification errors</span><strong>{lastRun?.error_count ?? "—"}</strong></div>
          <div><Clock3 size={17} /><span>Approx. next run</span><strong>{nextRun ? nextRun.toLocaleString() : "After cron is configured"}</strong></div>
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section-heading"><div><span className="eyebrow">INVESTIGATION QUEUE</span><h2>Verification monitor <span className="count-badge">{facts.length}</span></h2></div></div>
        {loading ? <div className="page-loading"><span className="spinner" /> Loading verification evidence…</div> : facts.length ? <div className="admin-list">{facts.map((fact) => (
          <article className={`admin-fact glass-card admin-fact-${fact.verification_status}`} key={fact.id}>
            <div className="admin-fact-meta"><span className="fact-category-text">{fact.category}</span><span>{fact.source_name || "Unknown source"} · {fact.confidence_score ?? 0}% · {fact.verification_checked_at ? new Date(fact.verification_checked_at).toLocaleString() : "Not checked"}</span></div>
            <div className="admin-fact-title-row"><h3>{fact.title}</h3><VerificationBadge status={fact.verification_status} confidence={fact.confidence_score} /></div>
            <textarea className="admin-correction" aria-label={`Correct description for ${fact.title}`} value={drafts[fact.id] ?? fact.body} onChange={(event) => setDrafts((current) => ({ ...current, [fact.id]: event.target.value }))} maxLength={300} />
            <div className="admin-evidence-preview">{(fact.evidence_sources || []).slice(0, 3).map((source, index) => <a href={source.url} key={`${source.url}-${index}`} target="_blank" rel="noreferrer">{source.name} · {source.supports ? "support" : "not confirmed"} ↗</a>)}</div>
            <p className="admin-notes">{fact.verification_notes}</p>
            {historyByFact[fact.id]?.length > 0 && <details className="admin-history"><summary>Verification history · {historyByFact[fact.id].length} events</summary><ol>{historyByFact[fact.id].map((event, index) => <li key={`${event.fact_id}-${event.created_at}-${index}`}><strong>{event.previous_status || "new"} → {event.new_status}</strong><span>{event.confidence_score ?? "—"}% · {new Date(event.created_at).toLocaleString()}</span></li>)}</ol></details>}
            <div className="admin-review-buttons">
              <button className="button button-approve" disabled={busyId === fact.id} onClick={() => saveCorrection(fact)}>Save correction</button>
              <button className="button button-quiet" disabled={busyId === fact.id} onClick={() => reverify(fact.id)}><RefreshCw size={14} /> Re-verify</button>
              {fact.verification_status !== "disputed" && <button className="button button-reject" disabled={busyId === fact.id} onClick={() => updateFact(fact, { verified: false, published_at: null, verification_status: "disputed", verification_notes: "Flagged for investigation by an administrator." }, "Fact withdrawn from public results and flagged for investigation.")}>Mark disputed</button>}
              {fact.verification_status !== "rejected" && <button className="button button-reject" disabled={busyId === fact.id} onClick={() => updateFact(fact, { verified: false, published_at: null, verification_status: "rejected", verification_notes: "Removed from publication by an administrator." }, "Fact removed from public results.")}>Remove</button>}
            </div>
          </article>
        ))}</div> : <div className="empty-panel admin-empty glass-card"><span className="empty-icon">✓</span><h2>No facts in the monitor.</h2><p>The scheduled fetch function will log verified and held facts here.</p></div>}
      </section>

      <section className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">COMMUNITY FEEDBACK</span><h2>Fact reports <span className="count-badge">{reports.length}</span></h2></div></div>
        {reports.length ? <div className="report-list">{reports.map((report) => <article className="report-row glass-card" key={report.id}><div><strong>{report.facts?.title || "Fact no longer available"}</strong><p>{report.reason}</p><small>{report.facts?.category || "Removed"} · {new Date(report.created_at).toLocaleString()}</small></div>{report.facts?.id && <div className="report-row-actions"><Link className="text-link" to={`/fact/${report.facts.id}`}>Open fact ↗</Link><button className="button button-reject" onClick={() => updateFact({ id: report.facts.id }, { verified: false, published_at: null, verification_status: "disputed", verification_notes: `Flagged from a community report: ${report.reason}` }, "Reported fact withdrawn from public results.")}>Withdraw from publication</button></div>}</article>)}</div> : !loading && <div className="empty-inline">No reports to investigate.</div>}
      </section>
    </main>
  );
}
