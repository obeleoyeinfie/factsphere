import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyClaim, type Claim, type Verification } from "../_shared/verification.ts";
import { corsJson, corsPreflight } from "../_shared/cors.ts";

type RawFact = {
  title: string;
  body: string;
  sourceUrl: string;
  sourceName: string;
  wikiTitle?: string;
  discussionUrl?: string;
};

type ExistingFact = {
  title: string;
  body: string;
  source_url: string;
  verified: boolean;
  verification_status: string;
  published_at: string | null;
};

const categoryKeywords: Record<string, string[]> = {
  Science: ["science", "experiment", "physics", "chemical", "molecule", "atom", "scientist"],
  Space: ["space", "planet", "star", "galaxy", "moon", "orbit", "astronomy", "mars", "venus"],
  History: ["history", "ancient", "century", "historic", "empire", "archaeolog", "civilization"],
  Animals: ["animal", "octopus", "shark", "bird", "whale", "insect", "mammal", "species", "fish"],
  Technology: ["technology", "computer", "internet", "software", "robot", "digital", "engine", "machine"],
  Geography: ["country", "capital", "island", "mountain", "river", "ocean", "continent", "population"],
  Food: ["food", "eat", "fruit", "vegetable", "cooking", "honey", "banana", "cheese", "chocolate"],
  "Human Body": ["body", "brain", "heart", "blood", "human", "bone", "skin", "muscle", "sleep"],
  Math: ["math", "number", "zero", "million", "mathemat", "percent", "equation"],
  Art: ["art", "painting", "artist", "sculpture", "museum", "design", "canvas"],
  Sports: ["sport", "football", "soccer", "olympic", "athlete", "game", "tennis", "baseball"],
  Psychology: ["psychology", "memory", "emotion", "behavior", "dream", "perception", "habit"],
  Nature: ["nature", "tree", "plant", "forest", "flower", "rain", "earth", "weather", "fungi"],
  Language: ["language", "word", "letter", "written", "alphabet", "linguistic", "etymology"],
  Music: ["music", "song", "musician", "instrument", "melody", "composer", "sound"],
  Economics: ["economy", "economic", "money", "market", "trade", "currency", "bank", "price"],
};

const requestHeaders = { "User-Agent": "FactSphere/1.0 (scheduled fact curation)" };

function cleanText(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[(?:citation needed|clarification needed|\d+(?:,\s*\d+)*)\]/gi, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[`*_>#~|]/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEnglish(value: string): boolean {
  const letters = value.match(/\p{L}/gu) ?? [];
  const latinLetters = value.match(/\p{Script=Latin}/gu) ?? [];
  return letters.length > 0 && latinLetters.length / letters.length >= 0.85;
}

function classify(text: string): { category: string; tags: string[] } {
  const normalized = text.toLowerCase();
  const scores = Object.entries(categoryKeywords).map(([category, words]) => ({
    category,
    score: words.reduce((score, word) => score + (normalized.includes(word) ? 1 : 0), 0),
  })).sort((left, right) => right.score - left.score);
  const category = scores[0]?.score ? scores[0].category : "Science";
  const tags = scores.filter((item) => item.score > 0).slice(0, 4)
    .map((item) => item.category.toLowerCase().replace(/\s+/g, "-"));
  return { category, tags: tags.length ? tags : [category.toLowerCase()] };
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function bigrams(value: string): Set<string> {
  const normalized = normalizeTitle(value);
  const result = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) result.add(normalized.slice(index, index + 2));
  return result;
}

function similarity(left: string, right: string): number {
  const a = bigrams(left);
  const b = bigrams(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  for (const pair of a) if (b.has(pair)) overlap += 1;
  return (2 * overlap) / (a.size + b.size);
}

async function requestJson<T>(url: string): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: requestHeaders, signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText} from ${new URL(url).hostname}`);
      return await response.json() as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("Request failed after retries");
}

async function fetchReddit(): Promise<RawFact[]> {
  const result = await requestJson<{ data?: { children?: { data: { title: string; permalink: string; url?: string; is_self?: boolean; selftext?: string; over_18?: boolean } }[] } }>(
    "https://www.reddit.com/r/todayilearned/top.json?t=day&limit=50",
  );
  return (result.data?.children ?? []).filter(({ data }) => !data.over_18).map(({ data }) => {
    const text = cleanText(data.selftext || data.title.replace(/^til:\s*/i, ""));
    const title = cleanText(data.title.replace(/^til:\s*/i, ""));
    let linkedArticle: string | null = null;
    try {
      const candidateUrl = new URL(data.url ?? "");
      if (candidateUrl.protocol === "https:" && !candidateUrl.hostname.endsWith("reddit.com")) linkedArticle = candidateUrl.href;
    } catch {
      linkedArticle = null;
    }
    return {
      title: title.length > 120 ? `${title.slice(0, 117)}...` : title,
      body: text,
      sourceUrl: !data.is_self && linkedArticle
        ? linkedArticle
        : `https://www.reddit.com${data.permalink}`,
      sourceName: "Reddit · r/todayilearned",
      discussionUrl: `https://www.reddit.com${data.permalink}`,
    };
  });
}

function htmlToText(value: string): string {
  return value
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#0?39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

async function fetchDidYouKnow(): Promise<RawFact[]> {
  const api = "https://en.wikipedia.org/w/api.php";
  const sectionUrl = `${api}?action=parse&page=Main_Page&prop=sections&format=json&origin=*`;
  const sections = await requestJson<{ parse?: { sections?: { index: string; line: string }[] } }>(sectionUrl);
  const section = sections.parse?.sections?.find((item) => item.line.toLowerCase().includes("did you know"));
  if (!section) return [];

  const contentUrl = `${api}?action=parse&page=Main_Page&prop=text&section=${encodeURIComponent(section.index)}&format=json&origin=*`;
  const content = await requestJson<{ parse?: { text?: { "*"?: string } } }>(contentUrl);
  const html = content.parse?.text?.["*"] ?? "";
  const facts: RawFact[] = [];
  for (const match of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const body = cleanText(htmlToText(match[1]));
    if (body.length < 40) continue;
    const pageLink = match[1].match(/href="\/wiki\/([^"#?]+)(?:#[^"]*)?"/i)?.[1];
    const wikiTitle = pageLink ? decodeURIComponent(pageLink.replace(/_/g, " ")) : undefined;
    const title = body.length > 110 ? `${body.slice(0, 107).replace(/\s+\S*$/, "")}...` : body;
    facts.push({
      title,
      body,
      sourceUrl: wikiTitle
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`
        : "https://en.wikipedia.org/wiki/Main_Page#Did_you_know",
      sourceName: "Wikipedia · Did you know",
      wikiTitle,
    });
  }
  return facts;
}

async function fetchWikipedia(): Promise<RawFact[]> {
  const randomUrl = "https://en.wikipedia.org/api/rest_v1/page/random/summary";
  const [didYouKnowResult, ...randomResults] = await Promise.allSettled([
    fetchDidYouKnow(),
    ...Array.from({ length: 5 }, () => requestJson<{ title?: string; extract?: string; content_urls?: { desktop?: { page?: string } } }>(randomUrl)),
  ]);
  const facts: RawFact[] = [];
  if (didYouKnowResult.status === "fulfilled") facts.push(...didYouKnowResult.value);
  for (const item of randomResults) {
    if (item.status === "fulfilled" && item.value.title && item.value.extract) {
      facts.push({
        title: item.value.title,
        body: item.value.extract,
        sourceUrl: item.value.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(item.value.title)}`,
        sourceName: "Wikipedia",
        wikiTitle: item.value.title,
      });
    }
  }
  if (didYouKnowResult.status === "rejected" && randomResults.every((item) => item.status === "rejected")) {
    throw new Error("Wikipedia APIs did not return any facts");
  }
  return facts;
}

async function fetchNumbers(): Promise<RawFact[]> {
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => requestJson<{ text?: string; number?: number }>("https://numbersapi.com/random/trivia?json")),
  );
  return results.flatMap((result) => {
    if (result.status !== "fulfilled" || !result.value.text) return [];
    const text = cleanText(result.value.text.replace(/^\d+\s+/, ""));
    if (text.length < 40) return [];
    return [{
      title: text.length > 120 ? `${text.slice(0, 117)}...` : text,
      body: `The number ${result.value.number} has an interesting story: ${text}`,
      sourceUrl: "https://numbersapi.com",
      sourceName: "Numbers API",
    }];
  });
}

async function fetchCountries(): Promise<RawFact[]> {
  const countries = await requestJson<{
    name?: { common?: string };
    capital?: string[];
    population?: number;
    area?: number;
    region?: string;
    cca2?: string;
  }[]>("https://restcountries.com/v3.1/all?fields=name,capital,population,area,region,cca2");
  return countries.filter((country) => country.name?.common && country.population).slice(0, 45).map((country) => {
    const name = country.name!.common!;
    const capital = country.capital?.[0];
    const body = `${name}${capital ? `, with ${capital} as its capital,` : ""} is in ${country.region || "the world"}. It has a population of about ${country.population!.toLocaleString("en-US")} people${country.area ? ` and covers ${country.area.toLocaleString("en-US")} square kilometres` : ""}.`;
    return {
      title: `${name} has a population of about ${country.population!.toLocaleString("en-US")}`,
      body,
      sourceUrl: `https://restcountries.com/v3.1/alpha/${country.cca2}`,
      sourceName: "REST Countries",
    };
  });
}

function categoryImageUrl(supabaseUrl: string, category: string): string {
  const filename = category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/category-defaults/${filename}.jpg`;
}

async function findImage(
  fact: RawFact,
  category: string,
  supabaseUrl: string,
  unsplashKey: string,
): Promise<{ url: string; attribution: string | null; license: string | null }> {
  if (fact.wikiTitle) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(fact.wikiTitle)}&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=1200&format=json&origin=*`;
    try {
      const result = await requestJson<{ query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string; descriptionurl?: string; extmetadata?: { Artist?: { value?: string }; LicenseShortName?: { value?: string } } }[] }> } }>(url);
      const image = Object.values(result.query?.pages ?? {})[0]?.imageinfo?.[0];
      if (image?.thumburl || image?.url) {
        return {
          url: image.thumburl ?? image.url!,
          attribution: image.extmetadata?.Artist?.value
            ? `Wikimedia Commons · ${htmlToText(image.extmetadata.Artist.value)}${image.descriptionurl ? ` · ${image.descriptionurl}` : ""}`
            : image.descriptionurl ?? null,
          license: image.extmetadata?.LicenseShortName?.value ?? null,
        };
      }
    } catch (error) {
      console.warn("Wikimedia Commons image lookup failed:", error);
    }
  }

  if (unsplashKey) {
    const words = cleanText(`${fact.title} ${fact.body}`).toLowerCase().match(/[a-z]{4,}/g) ?? [];
    const stopWords = new Set(["about", "after", "also", "being", "could", "first", "from", "have", "into", "more", "other", "some", "than", "that", "their", "there", "these", "this", "those", "through", "under", "were", "which", "with", "would"]);
    const keywords = [...new Set(words.filter((word) => !stopWords.has(word)))].slice(0, 3);
    try {
      const result = await requestJson<{ results?: { urls?: { regular?: string }; user?: { name?: string; links?: { html?: string } } }[] }>(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keywords.join(" ") || category)}&orientation=landscape&per_page=1&client_id=${encodeURIComponent(unsplashKey)}`,
      );
      const image = result.results?.[0]?.urls?.regular;
      if (image) {
        const photo = result.results?.[0];
        return {
          url: image,
          attribution: photo?.user?.name
            ? `Photo by ${photo.user.name} on Unsplash${photo.user.links?.html ? ` · ${photo.user.links.html}` : ""}`
            : "Unsplash",
          license: "Unsplash License",
        };
      }
    } catch (error) {
      console.warn("Unsplash image lookup failed:", error);
    }
  }
  return { url: categoryImageUrl(supabaseUrl, category), attribution: "FactSphere category defaults", license: "Project-provided image" };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return corsPreflight();
  if (request.method !== "POST") return corsJson({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const unsplashKey = Deno.env.get("UNSPLASH_ACCESS_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured");
    return corsJson({ error: "The fetch pipeline is not configured" }, 500);
  }
  const expectedAuthorization = ["Bearer", serviceRoleKey].join(" ");
  if (request.headers.get("authorization") !== expectedAuthorization) {
    return corsJson({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: run, error: runError } = await supabase.from("pipeline_runs")
    .insert({ function_name: "fetch-facts", status: "running" }).select("id").single();
  if (runError) {
    console.error("Could not start pipeline run record:", runError.message);
    return corsJson({ error: "Could not start pipeline run" }, 500);
  }
  const sources = [
    ["Reddit", fetchReddit],
    ["Wikipedia", fetchWikipedia],
    ["Numbers API", fetchNumbers],
    ["REST Countries", fetchCountries],
  ] as const;
  const sourceResults = await Promise.allSettled(sources.map(([, fetchSource]) => fetchSource()));
  const sourceErrors = sourceResults.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    const message = `${sources[index][0]}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`;
    console.error(message);
    return [message];
  });
  const rawFacts = sourceResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const candidates = rawFacts.flatMap((fact) => {
    const title = cleanText(fact.title);
    const body = cleanText(fact.body).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (!title || body.length < 40 || body.length > 300 || !isEnglish(`${title} ${body}`)) return [];
    return [{ ...fact, title, body }];
  });

  const existingFacts: ExistingFact[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("facts")
      .select("title, body, source_url, verified, verification_status, published_at")
      .range(offset, offset + 999);
    if (error) {
      console.error("Could not load existing fact titles for deduplication:", error.message);
      return corsJson({ error: "Could not check for duplicate facts" }, 500);
    }
    existingFacts.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const seenTitles = existingFacts.map((row) => row.title);
  const uniqueCandidates: RawFact[] = [];
  for (const fact of candidates) {
    if (seenTitles.some((title) => similarity(title, fact.title) > 0.8)) continue;
    seenTitles.push(fact.title);
    uniqueCandidates.push(fact);
  }

  const sourceCounts = new Map<string, number>();
  const balancedCandidates = uniqueCandidates.filter((fact) => {
    const count = sourceCounts.get(fact.sourceName) ?? 0;
    if (count >= 3) return false;
    sourceCounts.set(fact.sourceName, count + 1);
    return true;
  });
  const limitedCandidates = balancedCandidates.slice(0, 12);
  const prepared = await Promise.all(limitedCandidates.map(async (fact) => {
    const claim: Claim = {
      title: fact.title,
      body: fact.body,
      sourceUrl: fact.sourceUrl,
      sourceName: fact.sourceName,
      wikiTitle: fact.wikiTitle,
      discussionUrl: fact.discussionUrl,
    };
    const peers: Claim[] = existingFacts.filter((peer) =>
      peer.verified && peer.verification_status === "verified" && peer.published_at && peer.source_url !== fact.sourceUrl
    ).map((peer) => ({
      title: peer.title,
      body: peer.body,
      sourceUrl: peer.source_url,
      sourceName: "FactSphere verified fact",
    }));
    let verification: Verification;
    try {
      verification = await verifyClaim(claim, peers);
    } catch (error) {
      console.error(`Verification failed for "${fact.title}":`, error);
      verification = {
        status: "unverified",
        confidence: 0,
        evidence: [],
        notes: `Verification service failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    const classified = classify(`${fact.title} ${fact.body}`);
    const image = await findImage(fact, classified.category, supabaseUrl, unsplashKey);
    return {
      title: fact.title.slice(0, 180),
      body: fact.body,
      category: classified.category,
      tags: classified.tags,
      image_url: image.url,
      image_attribution: image.attribution,
      image_license: image.license,
      source_url: fact.sourceUrl,
      discussion_url: fact.discussionUrl ?? null,
      source_name: fact.sourceName,
      verified: verification.status === "verified",
      verification_status: verification.status,
      confidence_score: verification.confidence,
      evidence_sources: verification.evidence,
      verification_notes: verification.notes,
      verification_checked_at: new Date().toISOString(),
      published_at: verification.status === "verified" ? new Date().toISOString() : null,
    };
  }));
  let verifiedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  const storageErrors: string[] = [];
  for (const row of prepared) {
    if (row.verification_status === "rejected") {
      rejectedCount += 1;
      console.warn(`Discarded "${row.title}": ${row.verification_notes}`);
      continue;
    }
    const { data: insertedFact, error: insertError } = await supabase.from("facts").insert(row).select("id").single();
    if (insertError) {
      console.error("Could not store verified or quarantined fact:", insertError.message);
      storageErrors.push(insertError.message);
      continue;
    }
    if (row.verified) verifiedCount += 1;
    else pendingCount += 1;
  }

  const completedAt = new Date().toISOString();
  const allErrors = [...sourceErrors, ...storageErrors];
  const finalStatus = allErrors.length ? "partial" : "completed";
  const { error: finishError } = await supabase.from("pipeline_runs").update({
    status: finalStatus,
    completed_at: completedAt,
    facts_collected: candidates.length,
    facts_verified: verifiedCount,
    facts_pending: pendingCount,
    facts_rejected: rejectedCount,
    error_count: allErrors.length,
    details: { skippedAsDuplicates: candidates.length - uniqueCandidates.length, balancedCandidates: balancedCandidates.length, candidateLimit: 12, storageErrors },
  }).eq("id", run.id);
  if (finishError) console.error("Could not finish pipeline run record:", finishError.message);
  return corsJson({
    fetched: rawFacts.length,
    validated: candidates.length,
    stored: prepared.length,
    published: verifiedCount,
    heldForVerification: pendingCount,
    discarded: rejectedCount,
    skippedAsDuplicates: candidates.length - uniqueCandidates.length,
    sourceErrors,
  }, allErrors.length ? 207 : 200);
});
