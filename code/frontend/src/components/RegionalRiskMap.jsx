import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const LOCATIONS = {
  mathura: { label: "Mathura", coordinates: [27.4924, 77.6737] },
  bareilly: { label: "Bareilly", coordinates: [28.3670, 79.4304] },
};

function getLocation(region) {
  const key = String(region || "").toLowerCase();
  return Object.entries(LOCATIONS).find(([name]) => key.includes(name))?.[1] || null;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function RegionalRiskMap({ regionData = {} }) {
  const regions = Object.entries(regionData || {}).map(([name, values]) => ({ name, values, location: getLocation(name) }));
  const mapped = regions.filter((region) => region.location);

  if (!mapped.length) {
    return <p className="empty-table-cell">No verified regional locations are available for the current data.</p>;
  }

  return (
    <div className="regional-map-wrap">
      <MapContainer center={[27.93, 78.55]} zoom={7} scrollWheelZoom={false} className="regional-map" aria-label="Mathura and Bareilly operations map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {mapped.map(({ name, values, location }) => {
          const meters = number(values.meter_count);
          const flagged = number(values.flagged_count);
          const highRisk = number(values.high_risk_count);
          const flagRate = meters ? (flagged / meters) * 100 : 0;
          const color = highRisk > 0 ? "#dc2626" : flagged > 0 ? "#d97706" : "#059669";
          return (
            <CircleMarker key={name} center={location.coordinates} radius={Math.max(10, Math.min(25, 9 + Math.sqrt(meters)))} pathOptions={{ color, fillColor: color, fillOpacity: 0.68, weight: 2 }}>
              <Popup>
                <strong>{location.label}</strong><br />
                {meters} meters · {flagged} flagged<br />
                {highRisk} high-risk · {flagRate.toFixed(1)}% flagged
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="map-legend"><span><i className="map-dot good" /> Normal</span><span><i className="map-dot review" /> Review</span><span><i className="map-dot high" /> High-risk present</span></div>
    </div>
  );
}
