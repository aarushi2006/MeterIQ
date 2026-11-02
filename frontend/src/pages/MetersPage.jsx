import { useState, useEffect } from "react";
import CardHeader from "../components/CardHeader";
import Badge from "../components/Badge";
import { meterService } from "../services/meterService";

export default function MetersPage({ onSelectMeter }) {
  const [meters, setMeters] = useState([]);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [sortBy, setSortBy] = useState("score_desc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMeters() {
      setLoading(true);
      const data = await meterService.getMeters({
        search,
        region: regionFilter,
        status: statusFilter,
        risk: riskFilter
      });

      // Sorting
      const sorted = [...data].sort((a, b) => {
        if (sortBy === "score_desc") return b.score - a.score;
        if (sortBy === "score_asc") return a.score - b.score;
        if (sortBy === "kwh_desc") return b.currentKwh - a.currentKwh;
        if (sortBy === "id_asc") return a.id.localeCompare(b.id);
        return 0;
      });

      setMeters(sorted);
      setLoading(false);
    }
    fetchMeters();
  }, [search, regionFilter, statusFilter, riskFilter, sortBy]);

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>METER ANALYSIS</label>
          <h1>Meter Analysis</h1>
          <p>Search and select a meter to inspect its telemetry, anomaly risk, and forecast — across Mathura and Bareilly.</p>
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="filter-card">
        <div className="filter-grid">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by Meter ID, Area, or Feeder..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && <button className="clear-btn" onClick={() => setSearch("")}>✕</button>}
          </div>

          <div className="select-wrap">
            <label>Region</label>
            <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
              <option value="all">All Regions (Mathura & Bareilly)</option>
              <option value="Mathura">Mathura Circle</option>
              <option value="Bareilly">Bareilly Circle</option>
            </select>
          </div>

          <div className="select-wrap">
            <label>Risk Level</label>
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
              <option value="all">All Risk Levels</option>
              <option value="High">High Risk (Score &gt; 0.75)</option>
              <option value="Medium">Medium Risk (0.50 - 0.75)</option>
              <option value="Low">Low Risk (Normal)</option>
            </select>
          </div>

          <div className="select-wrap">
            <label>Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="Priority Review">Priority Review</option>
              <option value="Under Review">Under Review</option>
              <option value="Flagged">Flagged</option>
              <option value="Normal">Normal</option>
            </select>
          </div>

          <div className="select-wrap">
            <label>Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="score_desc">Highest Risk Score</option>
              <option value="score_asc">Lowest Risk Score</option>
              <option value="kwh_desc">Highest Current kWh</option>
              <option value="id_asc">Meter ID (A-Z)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Meter Table Card */}
      <article className="card table-card">
        <CardHeader
          title="Smart Meter Telemetry Records"
          text={`Showing ${meters.length} smart meters matching filters`}
          right={loading ? "Refreshing..." : "● Live Feed"}
        />
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Meter ID</th>
                <th>Region & Area</th>
                <th>Status</th>
                <th>Current kWh</th>
                <th>Avg Daily</th>
                <th>Peak kWh</th>
                <th>Last Reading</th>
                <th>Risk Level</th>
                <th>Risk Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {meters.map((m) => (
                <tr key={m.id} className="interactive-row" onClick={() => onSelectMeter(m)}>
                  <td>
                    <span className="meter-id-badge">{m.id}</span>
                  </td>
                  <td>
                    <div className="location-cell">
                      <span className="location-city">📍 {m.region}</span>
                      <small className="location-area">{m.area}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill ${m.status.toLowerCase().replace(/\s+/g, "-")}`}>
                      {m.status}
                    </span>
                  </td>
                  <td>
                    <span className="kwh-value">{m.currentKwh.toFixed(1)} kWh</span>
                  </td>
                  <td>
                    <span className="dimmed-val">{m.avgDailyKwh.toFixed(1)} kWh</span>
                  </td>
                  <td>
                    <span className="dimmed-val">{m.peakKwh.toFixed(1)} kWh</span>
                  </td>
                  <td>
                    <span className="time-val">{m.lastReading}</span>
                  </td>
                  <td>
                    <Badge risk={m.risk} />
                  </td>
                  <td>
                    <div className="score-cell">
                      <span className={`score-badge ${m.risk.toLowerCase()}`}>
                        {m.score.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button
                      className="inspect-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMeter(m);
                      }}
                    >
                      Inspect →
                    </button>
                  </td>
                </tr>
              ))}
              {meters.length === 0 && !loading && (
                <tr>
                  <td colSpan="10" className="empty-table-cell">
                    No smart meters matched the active query and filters.
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
