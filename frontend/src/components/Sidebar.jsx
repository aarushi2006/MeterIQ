import { useState } from "react";

// A single, consistent stroke-icon set instead of mixed emoji — keeps the
// sidebar looking like one deliberate design system rather than a grab-bag.
function Icon({ name }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
      );
    case "meters":
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>
      );
    case "consumption":
      return (
        <svg {...common}><path d="M3 17l5-6 4 4 8-9" /><path d="M14 6h6v6" /></svg>
      );
    case "anomalies":
      return (
        <svg {...common}><path d="M12 3l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></svg>
      );
    case "forecasting":
      return (
        <svg {...common}><path d="M4 19h16" /><path d="M7 15l3-5 3 3 4-7" /><path d="M17 6h3v3" /></svg>
      );
    case "investigations":
      return (
        <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M20 20l-4.3-4.3" /></svg>
      );
    case "reports":
      return (
        <svg {...common}><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h6" /></svg>
      );
    case "data-quality":
      return (
        <svg {...common}><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9.5 12l1.8 1.8L15 10" /></svg>
      );
    case "settings":
      return (
        <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 00-.15-1.45l2-1.55-2-3.46-2.36.95a7 7 0 00-2.5-1.45L13.6 2h-3.2l-.4 2.54a7 7 0 00-2.5 1.45l-2.36-.95-2 3.46 2 1.55A7 7 0 005 12c0 .5.05.98.15 1.45l-2 1.55 2 3.46 2.36-.95c.73.62 1.58 1.1 2.5 1.45l.4 2.54h3.2l.4-2.54a7 7 0 002.5-1.45l2.36.95 2-3.46-2-1.55c.1-.47.15-.95.15-1.45z" /></svg>
      );
    case "about":
      return (
        <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 16v-5" /><path d="M12 8h.01" /></svg>
      );
    case "logout":
      return (
        <svg {...common}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
      );
    default:
      return null;
  }
}

export default function Sidebar({ page, setPage, onLogout, role, isMobileOpen, setIsMobileOpen }) {
  const [collapsed, setCollapsed] = useState(false);

  // Primary navigation: the actual project surfaces. Kept short on purpose.
  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "meters", label: "Meter Analysis" },
    { id: "anomalies", label: "Anomalies" },
    { id: "forecasting", label: "Forecasting" },
    { id: "investigations", label: "Investigations" },
    { id: "reports", label: "Reports" },
    { id: "about", label: "About" },
  ];

  // Secondary/technical tools — still fully functional, just not competing
  // for top-level attention. Consumption Analytics, Data Quality and Meter
  // Health remain reachable here instead of being removed.
  const utilityItems = [
    { id: "consumption", label: "Consumption Analytics" },
    { id: "data-quality", label: "Data Quality" },
    { id: "meter-health", label: "Meter Health" },
    { id: "settings", label: "Settings" },
  ];

  const baseUrl = import.meta.env.BASE_URL || "/";
  const logoUrl = `${baseUrl.replace(/\/$/, "")}/meteriq-logo.png`;

  const handleNavClick = (id) => {
    setPage(id);
    if (setIsMobileOpen) setIsMobileOpen(false);
  };

  return (
    <aside className={`${collapsed ? "collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}`}>
      <div className="brand">
        <div className="brand-header">
          <div className="brand-logo-wrap">
            <img src={logoUrl} alt="MeterIQ" className="sidebar-logo-img" />
          </div>
          {!collapsed && (
            <div className="brand-text">
              <span className="brand-title">MeterIQ</span>
              <span className="brand-tagline">SMART METER ANALYTICS</span>
            </div>
          )}
        </div>
      </div>

      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label="Toggle Sidebar"
      >
        {collapsed ? "»" : "«"}
      </button>

      <nav>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={page === item.id || (page === "meter-detail" && item.id === "meters") ? "active" : ""}
            onClick={() => handleNavClick(item.id)}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon"><Icon name={item.id} /></span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <div className="nav-utility-group">
          <span className="nav-utility-label">More tools</span>
          {utilityItems.map((item) => (
            <button
              key={item.id}
              className={`nav-utility-link ${page === item.id ? "active" : ""}`}
              onClick={() => handleNavClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="sidebar-divider" />

      {!collapsed && (
        <div className="mode">
          <div className="mode-indicator">
            <span className="pulse-dot" />
            <span>Decision-Support Prototype</span>
          </div>
          <small>Region: Mathura & Bareilly</small>
        </div>
      )}

      <div className="team">
        {!collapsed && <div className="team-label">SIGNED IN AS</div>}
        <div className="team-member">
          <b className="avatar-pill">{role === "supervisor" ? "SV" : "DA"}</b>
          {!collapsed && (
            <div className="member-meta">
              <span className="member-role">{role === "supervisor" ? "Supervisor" : "Data Analyst"}</span>
            </div>
          )}
        </div>
      </div>

      <button className="logout-btn" onClick={onLogout} title={collapsed ? "Logout" : undefined}>
        <span className="nav-icon"><Icon name="logout" /></span>
        {!collapsed && <span className="nav-label">Logout</span>}
      </button>
    </aside>
  );
}
