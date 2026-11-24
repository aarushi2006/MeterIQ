const useCases = [
  {
    tag: "UC1",
    title: "Anomaly & theft-risk indicators",
    desc: "Combines a statistical baseline (deviation z-score, change versus the previous interval, and same-hour-last-week deviation) with an Isolation Forest model. The blended severity score classifies observations for review. A flag means “inspect this meter” — never “this consumer is stealing electricity.”",
  },
  {
    tag: "UC2",
    title: "Short-term load forecasting",
    desc: "Forecasts meter-level consumption and compares the trained model against a same-hour-last-week baseline. Evaluation uses a chronological holdout, so the reported error is measured on future data rather than a random split.",
  },
];

const stack = [
  { group: "Frontend", items: ["React 18", "Vite", "Recharts"] },
  { group: "API", items: ["Node.js", "Express", "JWT", "MongoDB"] },
  { group: "Analytics", items: ["Python", "FastAPI", "pandas", "PyArrow"] },
  { group: "ML", items: ["scikit-learn", "Isolation Forest", "HistGradientBoosting"] },
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
          A smart-meter analytics system for identifying anomalous consumption patterns
          and forecasting short-term electricity demand. Built as a Software Engineering
          project at Thapar Institute of Engineering and Technology.
        </p>
      </div>

      <div className="about-usecases">
        {useCases.map((item) => (
          <div className="about-usecase-row" key={item.tag}>
            <div className="about-usecase-tag">{item.tag}</div>
            <div>
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="about-tech">
        <h2>System architecture</h2>
        <p className="about-architecture">
          The React application talks only to the Node/Express API. Express owns
          authentication, users, investigations, and report generation in MongoDB, and
          proxies analytical requests to the FastAPI ML service. Analytics are served
          from an hourly cache built from the processed 3-minute telemetry, so no
          dashboard value is hand-entered or simulated.
        </p>
        <div className="about-stack-grid">
          {stack.map((group) => (
            <div key={group.group} className="about-stack-group">
              <strong>{group.group}</strong>
              <div className="tech-tags">
                {group.items.map((item) => (
                  <span key={item} className="tech-tag">{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="about-tech">
        <h2>Data & limitations</h2>
        <p className="about-architecture">
          The processed dataset contains roughly 19.6 million smart-meter observations
          across Bareilly and Mathura. Meter-level anomaly aggregates are present. Two
          optional artifacts — observation-level anomaly records and forecast
          predictions — are shown as explicitly unavailable when they have not been
          generated; the UI never substitutes mock rows or fabricated forecasts.
          Battery level, signal strength, and firmware are not part of this dataset and
          are therefore not displayed.
        </p>
      </div>

      <div className="about-team">
        <h2>Team</h2>
        <div className="about-team-grid">
          {team.map((member) => (
            <article key={member.name} className="about-member">
              <div className="about-avatar">
                {member.name.split(" ").map((part) => part[0]).join("")}
              </div>
              <div>
                <strong>{member.name}</strong>
                <small style={{ display: "block", color: "var(--text-muted)" }}>
                  {member.roll}
                </small>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
