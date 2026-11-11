export default function LoadingSkeleton({ count = 6, variant = "fact" }) {
  return (
    <div className={`skeleton-grid ${variant === "category" ? "category-grid" : ""}`} aria-label="Loading content" role="status">
      {Array.from({ length: count }, (_, index) => (
        <div className={`skeleton-card ${variant}`} key={index}>
          <div className="skeleton skeleton-image" />
          <div className="skeleton-line skeleton-short" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-medium" />
        </div>
      ))}
    </div>
  );
}
