const LABELS = {
  HIGH_RISK: "High",
  HIGH: "High",
  REVIEW: "Review",
  MEDIUM: "Medium",
  NORMAL: "Normal",
  LOW: "Low",
};

export default function Badge({ risk, children }) {
  const normalized = String(risk || "NORMAL").toUpperCase().replace(/[\s-]+/g, "_");
  const key = ["HIGH_RISK", "REVIEW", "NORMAL"].includes(normalized)
    ? normalized
    : normalized === "HIGH"
      ? "HIGH_RISK"
      : normalized === "MEDIUM"
        ? "REVIEW"
        : "NORMAL";

  return (
    <span className={`badge ${key.toLowerCase()}`}>
      {children || `${LABELS[key]} risk`}
    </span>
  );
}
