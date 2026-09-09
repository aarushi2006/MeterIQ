import { useState } from "react";

export default function Sidebar({ page, setPage }) {
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    { id: "dashboard", icon: "▦", label: "Dashboard" },
    { id: "analysis", icon: "⌁", label: "Meter Analysis" },
    { id: "health", icon: "●", label: "Meter Health" },
    { id: "alerts", icon: "!", label: "Alerts" },
    { id: "reports", icon: "📄", label: "Reports" },
    { id: "settings", icon: "⚙", label: "Settings" },
    { id: "about", icon: "✦", label: "About" },
  ];

  return (
    <aside className={collapsed ? "collapsed" : ""}>
      <div className="brand">
        {!collapsed ? (
          <img src="/meteriq-logo.svg" alt="MeterIQ" className="brand-logo" />
        ) : (
          <img src="/logo-compact.svg" alt="M" className="brand-logo-mini" />
        )}
      </div>

      <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? "»" : "«"}
      </button>

      <nav>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={page === item.id ? "active" : ""}
            onClick={() => setPage(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-divider" />

      {!collapsed && (
        <div className="mode">
          <i /> Demo environment
          <small>Mock data · API-ready</small>
        </div>
      )}

      <div className="team">
        {!collapsed && <div className="team-label">TEAM</div>}
        <div className="team-member">
          <b>YA</b>
          {!collapsed && <span>Yashit Arora</span>}
        </div>
        <div className="team-member">
          <b>AG</b>
          {!collapsed && <span>Aarushi Gahlawat</span>}
        </div>
      </div>
    </aside>
  );
}
