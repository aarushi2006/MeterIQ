import React, { useEffect, useState } from 'react';
import { anomalyService } from '../services/anomalyService';
import RegionalRiskMap from '../components/RegionalRiskMap';
import CardHeader from '../components/CardHeader';
import Stat from '../components/Stat';

const RiskMapPage = () => {
  const [regionStats, setRegionStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMapData() {
      try {
        const meters = await anomalyService.getMeters();
        const regions = {};
        
        meters.forEach(m => {
          const r = m.region || 'Unknown';
          if (!regions[r]) {
            regions[r] = { risk: 0, count: 0, flagged: 0 };
          }
          regions[r].count++;
          if (m.risk_level !== 'NORMAL') {
            regions[r].flagged++;
          }
        });

        const processed = {};
        Object.entries(regions).forEach(([name, data]) => {
          processed[name] = {
            risk: data.flagged / data.count,
            count: data.count
          };
        });

        setRegionStats(processed);
      } catch (e) {
        console.error("Failed to load map data", e);
      } finally {
        setLoading(false);
      }
    }
    loadMapData();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading Risk Map...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Regional Risk Hotspots</h1>
        <div className="flex gap-4">
          <Stat label="Total Regions" value={Object.keys(regionStats).length} />
          <Stat label="Avg Risk" value={`${(Object.values(regionStats).reduce((a, b) => a + b.risk, 0) / Object.keys(regionStats).length * 100).toFixed(1)}%`} color="orange" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <CardHeader title="Geographic Risk Distribution" subtitle="Visualizing anomaly concentration by region" />
          <div className="mt-6">
            <RegionalRiskMap regionData={regionStats} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <CardHeader title="Risk Rankings" subtitle="Regions sorted by severity" />
          <div className="mt-4 space-y-3">
            {Object.entries(regionStats)
              .sort(([, a], [, b]) => b.risk - a.risk)
              .map(([region, data]) => (
                <div key={region} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-medium text-slate-700">{region}</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${data.risk > 0.15 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    {(data.risk * 100).toFixed(1)}% Risk
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskMapPage;
