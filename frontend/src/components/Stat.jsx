export default function Stat({ icon, title, label, value, sub, trend, tone, color }) {
  const helper = trend ?? sub;
  const toneClass = tone || (color === "danger" ? "danger" : "");
  return (
    <article className="stat">
      <div className="stat-top">
        {icon && <span className="stat-icon">{icon}</span>}
        <span className="stat-label">{label || title}</span>
      </div>
      <h2 className="stat-value">{value ?? "—"}</h2>
      {helper && <small className={toneClass}>{helper}</small>}
    </article>
  );
}
