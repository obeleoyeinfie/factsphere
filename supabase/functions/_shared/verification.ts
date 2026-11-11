export type EvidenceSource = {
  name: string;
  url: string;
  domain: string;
  credibility: number;
  supports: boolean;
  contradicts: boolean;
  independent: boolean;
  evidence: string;
};

export type Verification = {
  status: "verified" | "partially_verified" | "disputed" | "unverified" | "rejected";
  confidence: number;
  evidence: EvidenceSource[];
  notes: string;
};

export type Claim = {
  title: string;
  body: string;
  sourceUrl: string;
  sourceName: string;
  wikiTitle?: string;
  discussionUrl?: string;
};

const stopWords = new Set([
  "about", "after", "also", "among", "been", "being", "between", "could", "first", "from",
  "have", "into", "more", "most", "other", "some", "than", "that", "their", "there", "these",
  "they", "this", "those", "through", "under", "were", "what", "when", "where", "which",
  "while", "with", "would", "into", "only", "such", "known", "often", "many", "each",
]);

const trustedSourceDomains = [
  "wikipedia.org", "wikimedia.org", "restcountries.com", "numbersapi.com", "reddit.com",
  "crossref.org", "doi.org", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "nasa.gov",
  "noaa.gov", "usgs.gov", "who.int", "un.org", "oecd.org", "worldbank.org", "britannica.com",
  "smithsonianmag.com", "smithsonian.org", "nature.com", "science.org", "sciencemag.org",
  "nationalgeographic.com", "history.com",
];

export function normalizeText(value: string): string {
  return value.toLocaleLowerCase().normalize("NFKD").replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function claimTokens(value: string): string[] {
  return normalizeText(value).split(/\s+/).filter((token) => token.length >= 4 && !stopWords.has(token));
}

export function tokenOverlap(claim: string, evidence: string): number {
  const expected = new Set(claimTokens(claim));
  const actual = new Set(claimTokens(evidence));
  if (!expected.size || !actual.size) return 0;
  let matches = 0;
  for (const token of expected) if (actual.has(token)) matches += 1;
  return matches / expected.size;
}

export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/^www\./, "").split(".");
  return labels.length < 2 ? hostname : labels.slice(-2).join(".");
}

function isTrustedUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const domain = registrableDomain(url.hostname);
    if (!trustedSourceDomains.includes(domain) && !url.hostname.endsWith(".gov") && !url.hostname.endsWith(".edu")) return null;
    return url;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<{ url: string; text: string } | null> {
  const firstUrl = isTrustedUrl(url);
  if (!firstUrl) return null;
  let nextUrl = firstUrl.href;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const safeUrl = isTrustedUrl(nextUrl);
    if (!safeUrl) return null;
    const response = await fetch(safeUrl, {
      headers: { "User-Agent": "FactSphere/1.0 (automated fact verification)" },
      redirect: "manual",
      signal: AbortSignal.timeout(9000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      nextUrl = new URL(location, safeUrl).href;
      continue;
    }
    if (!response.ok) return null;
    return { url: response.url || safeUrl.href, text: (await response.text()).slice(0, 500_000) };
  }
  return null;
}

function htmlToText(value: string): string {
  return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"").replace(/&#0?39;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
}

function credibilityFor(url: string): number {
  const domain = registrableDomain(new URL(url).hostname);
  if (domain.endsWith(".gov") || domain === "gov.uk" || domain.endsWith(".edu")) return 96;
  if (["crossref.org", "doi.org", "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "nature.com", "science.org", "sciencemag.org"].includes(domain)) return 92;
  if (["nasa.gov", "noaa.gov", "usgs.gov", "who.int", "un.org", "oecd.org", "worldbank.org"].includes(domain)) return 95;
  if (["wikipedia.org", "britannica.com", "smithsonian.org", "smithsonianmag.com", "nationalgeographic.com", "history.com"].includes(domain)) return 82;
  if (domain === "restcountries.com") return 68;
  if (domain === "numbersapi.com") return 58;
  if (domain === "reddit.com") return 42;
  return 60;
}

function makeEvidence(name: string, url: string, text: string, claim: string, primaryDomain: string): EvidenceSource | null {
  const safeUrl = isTrustedUrl(url);
  if (!safeUrl) return null;
  const overlap = tokenOverlap(claim, text);
  const supports = overlap >= 0.42;
  const claimNumbers = claim.match(/\b\d+(?:[.,]\d+)*(?:%|°)?\b/g) ?? [];
  const evidenceNumbers = text.match(/\b\d+(?:[.,]\d+)*(?:%|°)?\b/g) ?? [];
  const contradicts = overlap >= 0.68
    && claimNumbers.length > 0
    && evidenceNumbers.length > 0
    && claimNumbers.some((number) => !evidenceNumbers.includes(number));
  return {
    name,
    url: safeUrl.href,
    domain: registrableDomain(safeUrl.hostname),
    credibility: credibilityFor(safeUrl.href),
    supports,
    contradicts,
    independent: registrableDomain(safeUrl.hostname) !== primaryDomain,
    evidence: text.slice(0, 1200),
  };
}

async function searchWikipedia(claim: Claim, primaryDomain: string): Promise<EvidenceSource[]> {
  const terms = claimTokens(`${claim.title} ${claim.body}`).slice(0, 7).join(" ");
  if (!terms) return [];
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(terms)}&srlimit=3&format=json&origin=*`;
  const searchResponse = await fetch(searchUrl, { signal: AbortSignal.timeout(9000) });
  if (!searchResponse.ok) return [];
  const searchResult = await searchResponse.json() as { query?: { search?: { title: string }[] } };
  const results: EvidenceSource[] = [];
  for (const page of (searchResult.query?.search ?? []).slice(0, 2)) {
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
    const summaryResponse = await fetch(summaryUrl, { signal: AbortSignal.timeout(9000) });
    if (!summaryResponse.ok) continue;
    const summary = await summaryResponse.json() as { extract?: string; content_urls?: { desktop?: { page?: string } } };
    const excerpt = summary.extract ?? "";
    if (!excerpt) continue;
    const evidence = makeEvidence("Wikipedia", summary.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`, excerpt, `${claim.title}. ${claim.body}`, primaryDomain);
    if (evidence) results.push(evidence);
  }
  return results;
}

async function searchCrossref(claim: Claim, primaryDomain: string): Promise<EvidenceSource[]> {
  const terms = claimTokens(`${claim.title} ${claim.body}`).slice(0, 7).join(" ");
  if (!terms) return [];
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(terms)}&rows=5&select=title,URL,DOI,abstract,publisher`;
  const response = await fetch(url, {
    headers: { "User-Agent": "FactSphere/1.0 (mailto:contact@factsphere.example)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return [];
  const result = await response.json() as { message?: { items?: { title?: string[]; URL?: string; DOI?: string; abstract?: string; publisher?: string }[] } };
  const evidence: EvidenceSource[] = [];
  for (const item of (result.message?.items ?? []).slice(0, 5)) {
    const summary = htmlToText(`${item.title?.[0] ?? ""} ${item.abstract ?? ""}`);
    const sourceUrl = item.DOI
      ? `https://api.crossref.org/works/${encodeURIComponent(item.DOI)}`
      : item.URL || "";
    if (!sourceUrl || tokenOverlap(`${claim.title} ${claim.body}`, summary) < 0.42) continue;
    const source = makeEvidence(item.publisher || "Crossref-indexed research", sourceUrl, summary, `${claim.title}. ${claim.body}`, primaryDomain);
    if (source) evidence.push(source);
    if (evidence.length >= 2) break;
  }
  return evidence;
}

export async function verifyClaim(
  claim: Claim,
  peerClaims: Claim[] = [],
  options: { onePrimarySourceException?: boolean } = {},
): Promise<Verification> {
  const sourceUrl = isTrustedUrl(claim.sourceUrl);
  if (!sourceUrl) {
    return { status: "rejected", confidence: 0, evidence: [], notes: "The original source URL is missing, untrusted, or not HTTPS." };
  }

  const claimText = `${claim.title}. ${claim.body}`;
  const primaryPage = await fetchText(sourceUrl.href);
  if (!primaryPage) {
    return { status: "rejected", confidence: 0, evidence: [], notes: "The original source could not be resolved successfully over HTTPS." };
  }
  const primaryText = htmlToText(primaryPage.text);
  const primaryEvidence = makeEvidence(claim.sourceName, primaryPage.url, primaryText || claimText, claimText, registrableDomain(sourceUrl.hostname));
  const evidence: EvidenceSource[] = primaryEvidence ? [primaryEvidence] : [];
  if (claim.discussionUrl) {
    try {
      const discussion = await fetchText(claim.discussionUrl);
      if (discussion) {
        const source = makeEvidence("Reddit discussion", discussion.url, htmlToText(discussion.text), claimText, registrableDomain(sourceUrl.hostname));
        if (source) evidence.push(source);
      }
    } catch (error) {
      console.warn("Could not verify the Reddit discussion link:", error);
    }
  }

  const corroborationResults = await Promise.allSettled([
    searchWikipedia(claim, registrableDomain(sourceUrl.hostname)),
    searchCrossref(claim, registrableDomain(sourceUrl.hostname)),
  ]);
  for (const result of corroborationResults) {
    if (result.status === "fulfilled") evidence.push(...result.value);
    else console.warn("An independent-source search failed:", result.reason);
  }

  for (const peer of peerClaims) {
    if (peer.sourceUrl === claim.sourceUrl || !isTrustedUrl(peer.sourceUrl)) continue;
    const overlap = tokenOverlap(claimText, `${peer.title}. ${peer.body}`);
    if (overlap < 0.55) continue;
    const domain = registrableDomain(new URL(peer.sourceUrl).hostname);
    if (evidence.some((item) => item.domain === domain)) continue;
    evidence.push({
      name: peer.sourceName,
      url: peer.sourceUrl,
      domain,
      credibility: credibilityFor(peer.sourceUrl),
      supports: true,
      contradicts: false,
      independent: true,
      evidence: peer.body.slice(0, 1200),
    });
  }

  const supportive = evidence.filter((item) => item.supports);
  const independentDomains = new Set(supportive.filter((item) => item.independent).map((item) => item.domain));
  const primarySupports = supportive.some((item) => !item.independent);
  const hasIndependentAgreement = primarySupports && independentDomains.size >= 2;
  const supportRatio = evidence.length ? supportive.length / evidence.length : 0;
  const averageCredibility = supportive.length
    ? supportive.reduce((total, item) => total + item.credibility, 0) / supportive.length
    : 0;
  const independentAgreementScore = independentDomains.size >= 2 ? 100 : independentDomains.size === 1 ? 60 : 35;
  const directEvidenceScore = Math.min(100, supportRatio * 100);
  const consistencyScore = evidence.some((item) => !item.supports) ? 45 : supportive.length >= 2 ? 95 : 60;
  const confidence = Math.round(
    averageCredibility * 0.3
    + independentAgreementScore * 0.3
    + directEvidenceScore * 0.25
    + consistencyScore * 0.15,
  );
  const singleSourceException = options.onePrimarySourceException === true && supportive.some((item) => item.credibility >= 95);
  const verified = confidence >= 85 && (hasIndependentAgreement || singleSourceException)
    && !evidence.some((item) => item.credibility >= 80 && item.contradicts);
  const disputed = evidence.some((item) => item.credibility >= 85 && item.contradicts);

  return {
    status: verified ? "verified" : disputed ? "disputed" : supportive.length ? "partially_verified" : "unverified",
    confidence: disputed ? Math.min(confidence, 69) : confidence,
    evidence,
    notes: verified
      ? "Published automatically after source resolution, corroboration, and a confidence score of at least 85. Confidence is a deterministic evidence heuristic, not a proof of truth."
      : disputed
      ? `A credible source appears to conflict with a specific numeric detail. Held as disputed pending a human check. Confidence: ${confidence}/100.`
      : `Held from publication: ${supportive.length} supporting source(s), ${independentDomains.size} independent source domain(s), confidence ${confidence}/100. The pipeline requires confidence >=85, a supporting primary source, at least two supporting independent domains, and no strong contradiction.`,
  };
}
