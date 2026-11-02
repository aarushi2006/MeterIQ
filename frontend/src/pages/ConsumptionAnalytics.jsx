import { useState, useEffect } from "react";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import ConsumptionChart from "../charts/ConsumptionChart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { consumptionService } from "../services/consumptionService";
import { meterService } from "../services/meterService";

export default function ConsumptionAnalytics() {
  const [dateRange, setDateRange] = useState("7D");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedMeter, setSelectedMeter] = useState("all");
  const [trendData, setTrendData] = useState([]);
  const [diurnalData, setDiurnalData] = useState([]);
  const [regionalStats, setRegionalStats] = useState({});
  const [meterOptions, setMeterOptions] = useState([]);

  useEffect(() => {
    async function loadAnalytics() {
      const [trend, diurnal, reg, mtrs] = await Promise.all([
        consumptionService.getConsumptionTrend(dateRange, selectedRegion),
        consumptionService.getDiurnalPatterns(),
        consumptionService.getRegionalStats(),
        meterService.getMeters()
      ]);
      setTrendData(trend);
      setDiurnalData(diurnal);
      setRegionalStats(reg);
      setMeterOptions(mtrs);
    }
    loadAnalytics();
  }, [dateRange, selectedRegion]);

  // Derived KPIs based on current region
  const mathura = regionalStats.Mathura || { mwhToday: 61.8, peakLoadMw: 8.4, loadFactor: 0.76, avgDailyPerMeter: 9.78 };
  const bareilly = regionalStats.Bareilly || { mwhToday: 54.6, peakLoadMw: 7.2, loadFactor: 0.72, avgDailyPerMeter: 8.86 };

  let totalMwh = (mathura.mwhToday + bareilly.mwhToday).toFixed(1);
  let avgDailyPerMeter = ((mathura.avgDailyPerMeter + bareilly.avgDailyPerMeter) / 2).toFixed(2);
  let peakLoadMw = (mathura.peakLoadMw + bareilly.peakLoadMw).toFixed(1);
  let peakHour = "19:00 - 21:00";
  let loadFactor = (((mathura.loadFactor + bareilly.loadFactor) / 2) * 100).toFixed(0);

  if (selectedRegion === "Mathura") {
    totalMwh = mathura.mwhToday.toFixed(1);
    avgDailyPerMeter = mathura.avgDailyPerMeter.toFixed(2);
    peakLoadMw = mathura.peakLoadMw.toFixed(1);
    peakHour = mathura.peakHour;
    loadFactor = (mathura.loadFactor * 100).toFixed(0);
  } else if (selectedRegion === "Bareilly") {
    totalMwh = bareilly.mwhToday.toFixed(1);
    avgDailyPerMeter = bareilly.avgDailyPerMeter.toFixed(2);
    peakLoadMw = bareilly.peakLoadMw.toFixed(1);
    peakHour = bareilly.peakHour;
    loadFactor = (bareilly.loadFactor * 100).toFixed(0);
  }

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>ENERGY CONSUMPTION ANALYTICS</label>
          <h1>Consumption Analytics</h1>
          <p>Macro load profiles, diurnal curves, and distribution circle comparisons.</p>
        </div>
      </section>

      {/* Control Filter Bar */}
      <section className="filter-card">
        <div className="filter-grid">
          <div className="select-wrap">
            <label>Region Filter</label>
            <select value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
              <option value="all">All Circles (Mathura & Bareilly)</option>
              <option value="Mathura">Mathura Distribution Circle</option>
              <option value="Bareilly">Bareilly Distribution Circle</option>
            </select>
          </div>

          <div className="select-wrap">
            <label>Meter Filter</label>
            <select value={selectedMeter} onChange={(e) => setSelectedMeter(e.target.value)}>
              <option value="all">Aggregated Feeder Summary</option>
              {meterOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} ({m.region} - {m.area})
                </option>
              ))}
            </select>
          </div>

          <div className="select-wrap date-range-wrap">
            <label>Time Horizon</label>
            <div className="range-pills">
              {["7D", "30D", "3M", "6M", "12M"].map((r) => (
                <button
                  key={r}
                  className={`range-pill ${dateRange === r ? "active" : ""}`}
                  onClick={() => setDateRange(r)}
                >
                  {r === "7D" ? "7 Days" : r === "30D" ? "30 Days" : r === "3M" ? "3 Months" : r === "6M" ? "6 Months" : "12 Months"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5 Core Consumption KPIs */}
      <section className="stats kpi-grid-5">
        <Stat
          icon="⚡"
          title="Total Consumption"
          value={`${totalMwh} MWh`}
          sub="Current reporting period"
        />
        <Stat
          icon="📊"
          title="Avg Daily Consumption"
          value={`${avgDailyPerMeter} kWh`}
          sub="Per connected meter"
        />
        <Stat
          icon="🔥"
          title="Peak Load"
          value={`${peakLoadMw} MW`}
          sub="Coincident grid peak"
        />
        <Stat
          icon="⏱"
          title="Peak Window"
          value={peakHour}
          sub="Evening peak period"
        />
        <Stat
          icon="📈"
          title="Grid Load Factor"
          value={`${loadFactor}%`}
          sub="Optimal utilization target &gt; 70%"
        />
      </section>

      {/* Trend Overview */}
      <article className="card" style={{ marginBottom: "20px" }}>
        <CardHeader
          title={`Consumption Trend (${dateRange})`}
          text="Aggregated smart-meter time-series telemetry"
          right="Unit: MWh"
        />
        <ConsumptionChart data={trendData} height={260} />
      </article>

      {/* Diurnal Pattern & Regional Comparison Grid */}
      <section className="grid2">
        <article className="card">
          <CardHeader
            title="Hourly Diurnal Pattern"
            text="Weekday vs. Weekend average 24-hour demand profile"
          />
          <div className="chart-container" style={{ marginTop: "16px" }}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={diurnalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="weekday" name="Weekday (kWh)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="weekend" name="Weekend (kWh)" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card">
          <CardHeader
            title="Regional Circle Comparison"
            text="Telemetry metrics between Mathura and Bareilly smart grids"
          />
          <div className="regional-comp-table-wrap">
            <table className="regional-comp-table">
              <thead>
                <tr>
                  <th>Performance Metric</th>
                  <th>Mathura Circle</th>
                  <th>Bareilly Circle</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Total Meter Count</td>
                  <td><b>{mathura.meters?.toLocaleString()}</b></td>
                  <td><b>{bareilly.meters?.toLocaleString()}</b></td>
                </tr>
                <tr>
                  <td>Active Reporting</td>
                  <td><span className="success-tag">{mathura.meters ? ((mathura.activeReporting / mathura.meters) * 100).toFixed(1) : "—"}%</span></td>
                  <td><span className="success-tag">{bareilly.meters ? ((bareilly.activeReporting / bareilly.meters) * 100).toFixed(1) : "—"}%</span></td>
                </tr>
                <tr>
                  <td>Today's Consumption</td>
                  <td><b>{mathura.mwhToday} MWh</b></td>
                  <td><b>{bareilly.mwhToday} MWh</b></td>
                </tr>
                <tr>
                  <td>Average Daily / Meter</td>
                  <td>{mathura.avgDailyPerMeter} kWh</td>
                  <td>{bareilly.avgDailyPerMeter} kWh</td>
                </tr>
                <tr>
                  <td>Peak Coincident Demand</td>
                  <td>{mathura.peakLoadMw} MW</td>
                  <td>{bareilly.peakLoadMw} MW</td>
                </tr>
                <tr>
                  <td>Grid Load Factor</td>
                  <td>{((mathura.loadFactor || 0.76) * 100).toFixed(0)}%</td>
                  <td>{((bareilly.loadFactor || 0.72) * 100).toFixed(0)}%</td>
                </tr>
                <tr>
                  <td>Active Flagged Meters</td>
                  <td><span className="badge-warning">{mathura.flaggedMeters}</span></td>
                  <td><span className="badge-warning">{bareilly.flaggedMeters}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  );
}
