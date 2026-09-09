import { meters } from "../data/mockData";
import CardHeader from "../components/CardHeader";

export default function MeterHealth() {
  const online = meters.filter((m) => m.health === "Online").length;
  const offline = meters.filter((m) => m.health === "Offline").length;
  const faulty = meters.filter((m) => m.health === "Faulty").length;

  return (
    <>
      <section className="page-header">
        <label>METER OPERATIONS</label>
        <h1>Meter Health</h1>
        <p>Real-time status monitoring across all smart meters.</p>
      </section>

      <section className="stats">
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#ecfdf5", color: "#059669" }}>●</span>
            <span className="stat-label">Online</span>
          </div>
          <h2>{online}</h2>
          <small>Responding normally</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#fffbeb", color: "#d97706" }}>●</span>
            <span className="stat-label">Offline</span>
          </div>
          <h2>{offline}</h2>
          <small>No response</small>
        </article>
        <article className="stat">
          <div className="stat-top">
            <span className="stat-icon" style={{ background: "#fef2f2", color: "#dc2626" }}>●</span>
            <span className="stat-label">Faulty</span>
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
          <small>In monitoring</small>
        </article>
      </section>

      <article className="card">
        <CardHeader title="All Meters" text="Status overview for every connected meter" right={`${meters.length} total`} />
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Meter ID</th>
                <th>Location</th>
                <th>Health</th>
                <th>Firmware</th>
                <th>Last Ping</th>
                <th>Current kWh</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {meters.map((m) => (
                <tr key={m.id}>
                  <td><span className="meter-id">{m.id}</span></td>
                  <td>
                    <span className="location-city">{m.city}</span>
                    <span className="location-area">{m.area}</span>
                  </td>
                  <td>
                    <span className={`health-badge ${m.health.toLowerCase()}`}>● {m.health}</span>
                  </td>
                  <td><span className="time-value">{m.firmware}</span></td>
                  <td><span className="time-value">{m.lastPing}</span></td>
                  <td><span className="score-value">{m.kwh} kWh</span></td>
                  <td><span className={`status-badge ${m.status.toLowerCase().replace(/\s/g, "-")}`}>{m.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
