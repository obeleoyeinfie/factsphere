import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import FactCard from "../components/FactCard.jsx";
import LoadingSkeleton from "../components/LoadingSkeleton.jsx";
import Pagination from "../components/Pagination.jsx";
import { categoryBySlug } from "../lib/facts.js";
import { supabase } from "../lib/supabaseClient.js";
import useFacts from "../hooks/useFacts.js";
import { PUBLIC_FACT_COLUMNS } from "../lib/facts.js";

const PAGE_SIZE = 20;

export default function CategoryPage() {
  const { slug } = useParams();
  const category = categoryBySlug(slug);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const { data, loading, error } = useFacts(
    () => category
      ? supabase.from("facts").select(PUBLIC_FACT_COLUMNS, { count: "exact" }).eq("verified", true).not("published_at", "is", null).eq("category", category.name).order("likes", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      : Promise.resolve({ data: [], count: 0 }),
    [category?.name, page],
  );

  if (!category) return <main className="page-wrap page-content"><div className="empty-panel"><h1>Topic not found</h1><Link to="/categories">Browse all topics</Link></div></main>;
  const facts = data?.data || [];
  const totalPages = Math.ceil((data?.count || 0) / PAGE_SIZE);

  function changePage(nextPage) {
    const params = new URLSearchParams(searchParams);
    if (nextPage === 1) params.delete("page");
    else params.set("page", String(nextPage));
    navigate({ search: params.toString() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="page-wrap page-content">
      <Link to="/categories" className="back-link"><ArrowLeft size={15} /> All topics</Link>
      <div className="page-intro category-intro"><span className={`category-icon tone-${category.color}`}>{category.icon}</span><span className="eyebrow">{category.name.toUpperCase()} COLLECTION</span><h1>A little more<br /><span>{category.name.toLowerCase()}.</span></h1><p>Good things to know, all in one place.</p></div>
      {error && <div className="notice notice-error">{error.message}</div>}
      {loading ? <LoadingSkeleton count={8} /> : facts.length ? <div className="fact-grid">{facts.map((fact) => <FactCard key={fact.id} fact={fact} />)}</div> : <div className="empty-panel"><span className="empty-icon">{category.icon}</span><h2>Nothing here just yet.</h2><p>We’re collecting more {category.name.toLowerCase()} facts. Try another topic in the meantime.</p><Link className="button button-dark" to="/categories">Explore all topics</Link></div>}
      <Pagination page={page} totalPages={totalPages} onPageChange={changePage} />
    </main>
  );
}
