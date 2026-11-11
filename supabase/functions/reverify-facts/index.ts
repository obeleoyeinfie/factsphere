import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyClaim, type Claim, type Verification } from "../_shared/verification.ts";
import { corsJson, corsPreflight } from "../_shared/cors.ts";

type FactRow = {
  id: string;
  title: string;
  body: string;
  source_url: string;
  source_name: string;
  wikiTitle?: string;
  verification_status: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return corsPreflight();
  if (request.method !== "POST") return corsJson({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured");
    return corsJson({ error: "The re-verification pipeline is not configured" }, 500);
  }

  const authorization = request.headers.get("authorization") || "";
  const serviceToken = ["Bearer", serviceRoleKey].join(" ");
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  let isAdminCall = authorization !== serviceToken;
  if (isAdminCall) {
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token || token === authorization) return corsJson({ error: "Unauthorized" }, 401);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return corsJson({ error: "Unauthorized" }, 401);
    const { data: adminRecord, error: adminError } = await supabase.from("admin_users")
      .select("id").eq("id", userData.user.id).maybeSingle();
    if (adminError) {
      console.error("Could not verify re-verification administrator:", adminError.message);
      return corsJson({ error: "Could not verify administrator access" }, 500);
    }
    if (!adminRecord) return corsJson({ error: "Administrator access required" }, 403);
  }

  let requestedFactId: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (body && typeof body.fact_id === "string") requestedFactId = body.fact_id;
  } catch (error) {
    console.error("Could not read the re-verification request:", error);
    return corsJson({ error: "Invalid request body" }, 400);
  }
  if (requestedFactId && !isAdminCall) {
    return corsJson({ error: "Service-role cron calls cannot request one fact at a time" }, 400);
  }

  const { data: run, error: runError } = await supabase.from("pipeline_runs")
    .insert({ function_name: "reverify-facts", status: "running" }).select("id").single();
  if (runError) {
    console.error("Could not start re-verification run:", runError.message);
    return corsJson({ error: "Could not start re-verification run" }, 500);
  }

  let query = supabase.from("facts").select("id, title, body, source_url, source_name, verification_status");
  if (requestedFactId) query = query.eq("id", requestedFactId);
  else query = query.neq("verification_status", "rejected").order("verification_checked_at", { ascending: true, nullsFirst: true }).limit(10);
  const { data: facts, error: factsError } = await query;
  if (factsError) {
    console.error("Could not load facts for re-verification:", factsError.message);
    await supabase.from("pipeline_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_count: 1,
      details: { error: factsError.message },
    }).eq("id", run.id);
    return corsJson({ error: "Could not load facts for re-verification" }, 500);
  }

  let verifiedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  const errors: string[] = [];
  for (const fact of (facts ?? []) as FactRow[]) {
    let result: Verification;
    try {
      const { data: peers, error: peersError } = await supabase.from("facts")
        .select("title, body, source_url, source_name").neq("id", fact.id)
        .eq("verified", true).eq("verification_status", "verified").not("published_at", "is", null).limit(250);
      if (peersError) throw peersError;
      const claim: Claim = {
        title: fact.title,
        body: fact.body,
        sourceUrl: fact.source_url,
        sourceName: fact.source_name,
      };
      result = await verifyClaim(claim, (peers ?? []).map((peer) => ({
        title: peer.title,
        body: peer.body,
        sourceUrl: peer.source_url,
        sourceName: peer.source_name,
      })));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${fact.id}: ${message}`);
      console.error(`Could not re-verify fact ${fact.id}:`, message);
      continue;
    }

    const verified = result.status === "verified";
    const status = result.status === "rejected" ? "rejected" : result.status;
    const { error: updateError } = await supabase.from("facts").update({
      verified,
      verification_status: status,
      confidence_score: result.confidence,
      evidence_sources: result.evidence,
      verification_notes: result.notes,
      verification_checked_at: new Date().toISOString(),
      published_at: verified ? new Date().toISOString() : null,
    }).eq("id", fact.id);
    if (updateError) {
      errors.push(`${fact.id}: ${updateError.message}`);
      console.error(`Could not update verification result for ${fact.id}:`, updateError.message);
      continue;
    }
    if (verified) verifiedCount += 1;
    else if (result.status === "rejected") rejectedCount += 1;
    else pendingCount += 1;
  }

  const status = errors.length ? (verifiedCount || pendingCount || rejectedCount ? "partial" : "failed") : "completed";
  const { error: finishError } = await supabase.from("pipeline_runs").update({
    status,
    completed_at: new Date().toISOString(),
    facts_collected: facts?.length ?? 0,
    facts_verified: verifiedCount,
    facts_pending: pendingCount,
    facts_rejected: rejectedCount,
    error_count: errors.length,
    details: { errors },
  }).eq("id", run.id);
  if (finishError) console.error("Could not finish re-verification run:", finishError.message);

  return corsJson({
    checked: facts?.length ?? 0,
    verified: verifiedCount,
    pending: pendingCount,
    rejected: rejectedCount,
    errors,
  }, errors.length ? 207 : 200);
});
