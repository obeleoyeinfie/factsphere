import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { categorySlug } from "../lib/facts.js";

export default function CategoryCard({ category, count = 0 }) {
  return (
    <Link className={`category-card tone-${category.color}`} to={`/category/${categorySlug(category.name)}`}>
      <span className="category-icon" aria-hidden="true">{category.icon}</span>
      <span className="category-card-copy">
        <strong>{category.name}</strong>
        <small>{count} {count === 1 ? "fact" : "facts"}</small>
      </span>
      <ArrowUpRight size={17} aria-hidden="true" />
    </Link>
  );
}
