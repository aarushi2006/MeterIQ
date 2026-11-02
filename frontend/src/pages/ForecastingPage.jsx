import { useState, useEffect } from "react";
import CardHeader from "../components/CardHeader";
import Stat from "../components/Stat";
import { SkeletonCard } from "../components/Skeleton";
import { ForecastComparisonChart, ForecastErrorChart, computeForecastSummary } from "../charts/ForecastChart";
import { forecastService } from "../services/forecastService";
import { meterService } from "../services/meterService";
import { forecastModels } from "../data/mockData";

export default function ForecastingPage() {
  const [selectedMeter, setSelectedMeter] = useState("MTR1001");
  const [selectedModel, setSelectedModel] = useState("Random Forest");
  const [forecastHorizon, setForecastHorizon] = useState("24h");
  const [forecastData, setForecastData] = useState(null);
  const [metersList, setMetersList] = useState([]);
  const [loading, setLoading] = useState(true);

  async function runForecast() {
    setLoading(true);
    const res = await forecastService.getForecast(selectedMeter, selectedModel, forecastHorizon);
    setForecastData(res);
    setLoading(false);
  }

  useEffect(() => {
    meterService.getMeters().then(setMetersList);
  }, []);

  useEffect(() => {
    runForecast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeter, selectedModel, forecastHorizon]);

  const modelMetrics = forecastData?.modelDetails || {};
  const chartSeries = forecastData?.series || [];
  const summary = computeForecastSummary(chartSeries);
  const baselineMetrics = forecastModels["Baseline"];
  const showBaselineComparison = selectedModel !== "Baseline";

  return (
    <>
      <section className="page-header">
        <div className="page-header-title">
          <label>SHORT-TERM LOAD FORECASTING</label>
          <h1>Forecasting</h1>
          <p>Short-term electricity demand forecast, 15 minutes to 24 hours ahead.</p>
        </div>
      </section>

      {/* Controls */}
      <section className="filter-card">
        <div className="filter-grid forecast-controls-row">
          <div className="select-wrap">
            <label>Meter</label>
            <select value={selectedMeter} onChange={(e) => setSelectedMeter(e.target.value)}>
              {metersList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} ({m.region} · {m.area})
                </option>
              ))}
            </select>
          </div>

          <div className="select-wrap">
            <label>Model <span className="prototype-inline-tag">prototype selection</span></label>
            <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
              <option value="Baseline">Baseline (same-hour last week)</option>
              <option value="Linear Regression">Linear Regression</option>
              <option value="Random Forest">Random Forest</option>
            </select>
          </div>

          <div className="select-wrap">
            <label>Forecast Horizon <span className="prototype-inline-tag">15 min – 24h scope</span></label>
            <div className="range-pills">
              {["15m", "1h", "6h", "12h", "24h"].map((h) => (
                <button
                  key={h}
                  className={`range-pill ${forecastHorizon === h ? "active" : ""}`}
                  onClick={() => setForecastHorizon(h)}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <button className="primary run-forecast-btn" onClick={runForecast} disabled={loading}>
            {loading ? "Running..." : "Run Forecast"}
          </button>
        </div>
      </section>

      {/* Metrics — explicitly labeled as prototype/demo, never as final results */}
      <div className="eval-mode-header">
        <span className="eval-mode-tag active">Prototype / Demo Evaluation</span>
        <span className="eval-mode-tag disabled">Actual Model Evaluation — not yet available</span>
      </div>
      <section className="stats">
        <Stat
          title="MAE"
          value={modelMetrics.mae || "—"}
          sub={showBaselineComparison ? `Mean absolute error · Baseline: ${baselineMetrics.mae}` : "Mean absolute error (baseline)"}
        />
        <Stat
          title="RMSE"
          value={modelMetrics.rmse || "—"}
          sub={showBaselineComparison ? `Penalizes large errors · Baseline: ${baselineMetrics.rmse}` : "Penalizes large errors"}
        />
        <Stat
          title="MAPE"
          value={modelMetrics.mape || "—"}
          sub={showBaselineComparison ? `Relative % error · Baseline: ${baselineMetrics.mape}` : "Relative percentage error"}
        />
        <Stat title="Validation" value="Chronological" sub="Same-hour-last-week baseline planned" />
      </section>
      <p className="eval-note">
        {forecastData?.evaluationNote || "Prototype / demo values for UI development — not from a trained model yet."}{" "}
        The model selected above is a prototype selection for UI development, not a final chosen
        model. Once the ML pipeline is complete, these will be evaluated on a one-month holdout
        against a same-hour-last-week baseline.
      </p>

      {/* Actual vs Predicted */}
      <article className="card" style={{ marginTop: "16px", marginBottom: "16px" }}>
        <CardHeader
          title={`Actual vs. Predicted — ${selectedMeter} (${selectedModel})`}
          text={`${forecastHorizon} horizon · demo series, not live model output`}
        />
        {loading ? <SkeletonCard /> : <ForecastComparisonChart data={chartSeries} />}
      </article>

      {/* Prediction error */}
      <article className="card" style={{ marginBottom: "16px" }}>
        <CardHeader
          title="Prediction Error"
          text="Actual minus predicted, for points where an actual reading exists"
        />
        <p className="eval-note" style={{ marginTop: 0, marginBottom: "10px" }}>
          Positive values indicate under-prediction (actual came in higher than predicted);
          negative values indicate over-prediction (actual came in lower than predicted).
        </p>
        <ForecastErrorChart data={chartSeries} />
      </article>

      {/* Forecast summary — computed from the series above, not invented separately */}
      <article className="card">
        <CardHeader title="Forecast Summary" text="Derived from the chart above" />
        <div className="forecast-summary-grid">
          <div className="forecast-summary-item">
            <span className="forecast-summary-label">Forecast Range</span>
            <span className="forecast-summary-value">{summary.range}</span>
          </div>
          <div className="forecast-summary-item">
            <span className="forecast-summary-label">Peak Predicted Load</span>
            <span className="forecast-summary-value">{summary.peak}</span>
          </div>
          <div className="forecast-summary-item">
            <span className="forecast-summary-label">Average Predicted Load</span>
            <span className="forecast-summary-value">{summary.average}</span>
          </div>
          <div className="forecast-summary-item">
            <span className="forecast-summary-label">Maximum Deviation</span>
            <span className="forecast-summary-value">{summary.maxDeviation}</span>
          </div>
        </div>
      </article>

      {/* Planned pipeline — explicitly future work, not implemented yet */}
      <section className="grid2" style={{ marginTop: "16px" }}>
        <article className="card">
          <CardHeader
            title="Planned Feature Pipeline"
            text="Not yet trained — this is the intended feature set for UC2"
          />
          <div className="specs-list">
            <div className="spec-row">
              <span className="spec-name">Lag features:</span>
              <span className="spec-desc">1, 2, 3, 6, 12, 24, 48, 168 intervals</span>
            </div>
            <div className="spec-row">
              <span className="spec-name">Rolling windows:</span>
              <span className="spec-desc">Rolling mean/std at 20, 100, 480 intervals</span>
            </div>
            <div className="spec-row">
              <span className="spec-name">Cyclical temporal:</span>
              <span className="spec-desc">Sine/cosine of hour-of-day and day-of-week</span>
            </div>
            <div className="spec-row">
              <span className="spec-name">Leakage prevention:</span>
              <span className="spec-desc">Rolling statistics computed with a shift(1) offset</span>
            </div>
          </div>
        </article>

        <article className="card">
          <CardHeader
            title="Evaluation Plan"
            text="How UC2 will actually be scored once the model exists"
          />
          <div className="specs-list">
            <div className="spec-row">
              <span className="spec-name">Baseline:</span>
              <span className="spec-desc">Same-hour-last-week</span>
            </div>
            <div className="spec-row">
              <span className="spec-name">Holdout:</span>
              <span className="spec-desc">One-month chronological holdout</span>
            </div>
            <div className="spec-row">
              <span className="spec-name">Metrics:</span>
              <span className="spec-desc">MAE, MAPE, RMSE — compared against the baseline</span>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}
