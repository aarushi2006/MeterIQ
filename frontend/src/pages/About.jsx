const usecases = [
  {
    tag: "UC1",
    title: "Anomaly / Theft-Risk Detection",
    desc: "Flags meters with unusual consumption for human review. The system reports risk indicators such as \"Anomaly Detected\" or \"Requires Investigation\" — it never labels a consumer as confirmed to be stealing electricity. That determination stays with a human investigator after physical verification.",
  },
  {
    tag: "UC2",
    title: "Short-Term Load Forecasting",
    desc: "Predicts electricity demand 15 minutes to 24 hours ahead to support grid capacity planning, using a same-hour-last-week baseline compared against ML forecasting models.",
  },
];

const team = [
  { name: "Yashit Arora", roll: "1024160006" },
  { name: "Aarushi Gahlawat", roll: "1024160008" },
];

export default function About() {
  return (
    <section className="about">
      <div className="about-hero">
        <label>ABOUT METERIQ</label>
        <h1>Explainable Smart Meter Analytics Platform</h1>
        <p>
          A smart-meter analytics system for identifying anomalous consumption patterns and
          forecasting short-term electricity demand, built as a Software Engineering (UCS503)
          project at Thapar Institute of Engineering and Technology.
        </p>
      </div>

      <div className="about-usecases">
        {usecases.map((u) => (
          <div className="about-usecase-row" key={u.tag}>
            <div className="about-usecase-tag">{u.tag}</div>
            <div>
              <h3>{u.title}</h3>
              <p>{u.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="about-tech">
        <h2>Built with</h2>
        <div className="tech-tags">
          <span className="tech-tag">React</span>
          <span className="tech-tag">Vite</span>
          <span className="tech-tag">Recharts</span>
          <span className="tech-tag">Python</span>
          <span className="tech-tag">pandas</span>
          <span className="tech-tag">scikit-learn</span>
        </div>
        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "10px" }}>
          The frontend currently runs on a local prototype dataset. The Python preprocessing
          and ML pipeline (feature engineering, anomaly detection, forecasting) is being
          developed separately and is not yet connected to this dashboard.
        </p>
      </div>

      <div className="about-team">
        <h2>Team</h2>
        <div className="about-team-grid">
          {team.map((m) => (
            <article key={m.name} className="about-member">
              <div className="about-avatar">
                {m.name.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <strong>{m.name}</strong>
                <small style={{ display: "block", color: "var(--text-muted)" }}>{m.roll}</small>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
