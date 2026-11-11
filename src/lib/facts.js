import { supabase } from "./supabaseClient.js";

export const CATEGORIES = [
  { name: "Science", icon: "⚗️", color: "mint" },
  { name: "Space", icon: "🪐", color: "lavender" },
  { name: "History", icon: "🏺", color: "peach" },
  { name: "Animals", icon: "🐙", color: "pink" },
  { name: "Technology", icon: "🤖", color: "blue" },
  { name: "Geography", icon: "🌍", color: "green" },
  { name: "Food", icon: "🍋", color: "yellow" },
  { name: "Human Body", icon: "🫀", color: "pink" },
  { name: "Math", icon: "🧮", color: "lavender" },
  { name: "Art", icon: "🎨", color: "peach" },
  { name: "Sports", icon: "🏓", color: "mint" },
  { name: "Psychology", icon: "🧠", color: "blue" },
  { name: "Nature", icon: "🌱", color: "green" },
  { name: "Language", icon: "💬", color: "yellow" },
  { name: "Music", icon: "🎧", color: "lavender" },
  { name: "Economics", icon: "📈", color: "peach" },
];

export const PUBLIC_FACT_COLUMNS = "id,title,body,category,tags,image_url,source_url,source_name,views,likes,verified,created_at,verification_status,confidence_score,evidence_sources,verification_checked_at,published_at,image_attribution,image_license,discussion_url";

export function categorySlug(category) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function categoryBySlug(slug) {
  return CATEGORIES.find((category) => categorySlug(category.name) === slug);
}

export function dayOfYear(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

export function isFresh(createdAt) {
  return createdAt && Date.now() - new Date(createdAt).getTime() < 86400000;
}

export function popularity(fact) {
  return Number(fact.views || 0) * 0.4 + Number(fact.likes || 0) * 0.6;
}

export function getFavoriteIds() {
  try {
    const stored = JSON.parse(localStorage.getItem("factsphere:favorites") || "[]");
    return Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : [];
  } catch (error) {
    console.error("Could not read saved facts from local storage.", error);
    return [];
  }
}

export function setFavoriteIds(ids) {
  try {
    localStorage.setItem("factsphere:favorites", JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent("factsphere:favorites-changed", { detail: ids }));
  } catch (error) {
    console.error("Could not save your favorites.", error);
    throw error;
  }
}

const likesSentInSession = new Set();
const likesPendingInSession = new Set();

export async function registerLike(factId) {
  let stored = [];
  try {
    stored = JSON.parse(localStorage.getItem("factsphere:likes-sent") || "[]");
  } catch (error) {
    console.error("Could not read the local like history.", error);
  }
  const sent = new Set(Array.isArray(stored) ? stored : []);
  if (sent.has(factId) || likesSentInSession.has(factId) || likesPendingInSession.has(factId) || !supabase) return null;
  likesPendingInSession.add(factId);
  let data;
  try {
    const result = await supabase.rpc("increment_likes", { fact_id: factId });
    if (result.error) throw result.error;
    data = result.data;
    likesSentInSession.add(factId);
  } finally {
    likesPendingInSession.delete(factId);
  }
  sent.add(factId);
  try {
    localStorage.setItem("factsphere:likes-sent", JSON.stringify([...sent]));
  } catch (error) {
    console.error("Could not persist like state.", error);
  }
  return typeof data === "number" ? data : null;
}
