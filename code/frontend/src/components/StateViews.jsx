export function LoadingState({ label = "Loading data…" }) {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
      <p className="loading-text">{label}</p>
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  return (
    <div className="error-view" role="alert">
      <h2>{title}</h2>
      <p>{message || "The request could not be completed."}</p>
      {onRetry && (
        <button type="button" className="primary dashboard-retry-button" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title = "No data", message, action }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function InlineNotice({ tone = "info", title, children }) {
  return (
    <div className={`inline-notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
      {title && <strong>{title}</strong>}
      {children && <div className="inline-notice-body">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
