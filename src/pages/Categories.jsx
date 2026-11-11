import CategoryCard from "../components/CategoryCard.jsx";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import { CATEGORIES } from "../lib/facts.js";
import { supabase } from "../lib/supabaseClient.js";
import useFacts from "../hooks/useFacts.js";

export default function Categories() {
  const { data, loading, error } = useFacts(
    () => supabase.from("facts").select("category").eq("verified", true)
      .eq("verification_status", "verified").not("published_at", "is", null).limit(10000),
    [],
  );
  const counts = Object.fromEntries(CATEGORIES.map((category) => [
    category.name,
    data?.filter((fact) => fact.category === category.name).length || 0,
  ]));

  return (
    <main className="page-wrap page-content">
      <div className="page-intro"><span className="eyebrow">YOUR NEXT RABBIT HOLE</span><h1>Pick a subject.<br /><span>Find a wonder.</span></h1><p>From the microscopic to the cosmic, there’s a little something for every curious mind.</p></div>
      {error && <div className="notice notice-error">{error.message}</div>}
      {loading ? <LoadingSkeleton count={12} variant="category" /> : <div className="category-grid categories-large">{CATEGORIES.map((category) => <CategoryCard key={category.name} category={category} count={counts[category.name]} />)}</div>}
    </main>
  );
}
