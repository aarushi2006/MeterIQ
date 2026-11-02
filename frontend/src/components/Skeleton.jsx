export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-line short" />
      <div className="skeleton-line long" />
      <div className="skeleton-line medium" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-circle" />
          <div className="skeleton-line medium" />
          <div className="skeleton-line short" />
          <div className="skeleton-line tiny" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="skeleton-stats">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton-stat">
          <div className="skeleton-circle small" />
          <div className="skeleton-line short" />
          <div className="skeleton-line medium" />
        </div>
      ))}
    </div>
  );
}
