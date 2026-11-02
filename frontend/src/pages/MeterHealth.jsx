import { meters } from "../data/mockData";
import CardHeader from "../components/CardHeader";

// Display-only relabeling: the underlying mock field values stay
// Online/Offline/Faulty, but the page speaks in plain risk-neutral
// connectivity language rather than implying a live monitoring feed.
const HEALTH_LABELS = {
  Online: "Normal",
  Offline: "Attention Required",
  Faulty: "Warning",
};

export default function MeterHealth() {
  const online = meters.filter((m) => m.health === "Online").length;
  const offline = meters.filter((m) => m.health === "Offline").length;
  const faulty = meters.filter((m) => m.health === "Faulty").length;

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>METER CONNECTIVITY</label>
          <h1>Meter Health</h1>
          <p>Prototype snapshot of meter connectivity and device status.</p>
        </div>
      </section>

      <section className="stats">
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>●</span>
            <span className="stat-label">Normal</span>
          </div>
          <h2>{online}</h2>
          <small>Responding normally</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>●</span>
            <span className="stat-label">Attention Required</span>
          </div>
          <h2>{offline}</h2>
          <small>No response</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}>●</span>
            <span className="stat-label">Warning</span>
          </div>
          <h2>{faulty}</h2>
          <small>Needs maintenance</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>⌁</span>
            <span className="stat-label">Total Meters</span>
          </div>
          <h2>{meters.length}</h2>
          <small>In prototype dataset</small>
        </article>
      </section>

      <article className="card">
        <CardHeader title="All Meters" text="Connectivity snapshot for every meter in the dataset" right={`${meters.length} total`} />
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Meter ID</th>
                <th>Location</th>
                <th>Status</th>
                <th>Firmware</th>
                <th>Last Ping</th>
                <th>Current Reading</th>
              </tr>
            </thead>
            <tbody>
              {meters.map((m) => (
                <tr key={m.id}>
                  <td><span className="meter-id">{m.id}</span></td>
                  <td>
                    <span className="location-city">{m.region}</span>
                    <span className="location-area">{m.area}</span>
                  </td>
                  <td>
                    <span className={`health-badge ${m.health.toLowerCase()}`}>
                      ● {HEALTH_LABELS[m.health] || m.health}
                    </span>
                  </td>
                  <td><span className="time-value">{m.firmware}</span></td>
                  <td><span className="time-value">{m.lastReading}</span></td>
                  <td><span className="score-value">{m.currentKwh?.toFixed?.(1) ?? m.currentKwh} kWh</span></td>
                </tr>
              ))}
              {meters.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-table-cell">
                    No meters found in the prototype dataset.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
