import Badge from "../components/Badge";

export default function MeterTable({ meters, onSelect }) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Meter ID</th>
            <th>Location</th>
            <th>Risk level</th>
            <th>Anomaly score</th>
            <th>Forecast</th>
            <th>Last analyzed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {meters.map((m) => (
            <tr key={m.id} onClick={() => onSelect(m)}>
              <td>
                <span className="meter-id">{m.id}</span>
              </td>
              <td>
                <span className="location-city">{m.city}</span>
                <span className="location-area">{m.area}</span>
              </td>
              <td>
                <Badge risk={m.risk} />
              </td>
              <td>
                <span className="score-value">{m.score.toFixed(2)}</span>
              </td>
              <td>
                <span className="forecast-badge ready">● Ready</span>
              </td>
              <td>
                <span className="time-value">{m.time}</span>
              </td>
              <td>
                <span className="arrow">›</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
