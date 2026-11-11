import { useEffect, useState } from "react";
import { getFavoriteIds, registerLike, setFavoriteIds } from "../lib/facts.js";

export default function useFavorites(factId) {
  const [liked, setLiked] = useState(() => getFavoriteIds().includes(factId));
  const [error, setError] = useState("");
  const [registeredCount, setRegisteredCount] = useState(null);

  useEffect(() => {
    setLiked(getFavoriteIds().includes(factId));
    setRegisteredCount(null);
    setError("");
    function sync(event) {
      setLiked((event.detail || getFavoriteIds()).includes(factId));
    }
    window.addEventListener("factsphere:favorites-changed", sync);
    return () => window.removeEventListener("factsphere:favorites-changed", sync);
  }, [factId]);

  async function toggle() {
    const current = getFavoriteIds();
    const adding = !current.includes(factId);
    setError("");
    try {
      setFavoriteIds(adding ? [...current, factId] : current.filter((id) => id !== factId));
    } catch (storageError) {
      console.error("Could not update your favorites.", storageError);
      setError("Your browser could not save this favorite.");
      return;
    }
    setLiked(adding);
    if (adding) {
      try {
        const count = await registerLike(factId);
        if (typeof count === "number") setRegisteredCount(count);
      } catch (likeError) {
        console.error("Could not register your like.", likeError);
        setError("Saved to favorites, but the like count could not be updated.");
      }
    }
  }
  return { liked, toggle, error, registeredCount };
}
