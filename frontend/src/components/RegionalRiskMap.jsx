import React from 'react';

const RegionalRiskMap = ({ regionData }) => {
  // regionData: { "Bareilly": { risk: 0.12, count: 46 }, "Mathura": { risk: 0.18, count: 38 } }
  
  const getColor = (risk) => {
    if (risk > 0.2) return '#ef4444'; // Red (High)
    if (risk > 0.1) return '#f59e0b'; // Orange (Medium)
    if (risk > 0.05) return '#facc15'; // Yellow (Low)
    return '#10b981'; // Green (Safe)
  };

  return (
    <div className="relative w-full h-64 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center">
      <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
      
      <div className="flex gap-12 z-10">
        {Object.entries(regionData).map(([region, data]) => (
          <div key={region} className="flex flex-col items-center group cursor-pointer">
            <div 
              className="w-24 h-24 rounded-full transition-all duration-300 group-hover:scale-110 shadow-lg flex items-center justify-center text-white font-bold text-xl"
              style={{ 
                backgroundColor: getColor(data.risk),
                boxShadow: `0 0 20px ${getColor(data.risk)}88`
              }}
            >
              {Math.round(data.risk * 100)}%
            </div>
            <span className="mt-3 font-semibold text-slate-700">{region}</span>
            <span className="text-xs text-slate-500">{data.count} Meters</span>
          </div>
        ))}
      </div>
      
      <div className="absolute bottom-4 right-4 flex gap-4 text-xs">
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> High Risk</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-500"></div> Medium Risk</div>
        <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-green-500"></div> Low Risk</div>
      </div>
    </div>
  );
};

export default RegionalRiskMap;
