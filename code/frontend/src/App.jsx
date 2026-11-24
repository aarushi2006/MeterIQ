import { useCallback, useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import { ToastProvider, useToast } from "./components/Toast";
import { LoadingState } from "./components/StateViews";
import Dashboard from "./pages/Dashboard";
import MetersPage from "./pages/MetersPage";
import MeterAnalysis from "./pages/MeterAnalysis";
import ConsumptionAnalytics from "./pages/ConsumptionAnalytics";
import AnomalyDetection from "./pages/AnomalyDetection";
import ForecastingPage from "./pages/ForecastingPage";
import InvestigationsPage from "./pages/InvestigationsPage";
import Reports from "./pages/Reports";
import DataQualityPage from "./pages/DataQualityPage";
import MeterHealth from "./pages/MeterHealth";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import About from "./pages/About";
import { authService } from "./services/authService";
import { getPreferences } from "./services/preferences";
import "./styles.css";

function AppShell() {
  const [currentUser, setCurrentUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [authView, setAuthView] = useState("login");
  const [page, setPage] = useState("dashboard");
  const [selectedMeterId, setSelectedMeterId] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [compactTables, setCompactTables] = useState(
    () => getPreferences().compactTables
  );
  const { addToast } = useToast();

  useEffect(() => {
    function handlePreferences() {
      setCompactTables(getPreferences().compactTables);
    }
    window.addEventListener("meteriq:preferences", handlePreferences);
    return () =>
      window.removeEventListener("meteriq:preferences", handlePreferences);
  }, []);

  useEffect(() => {
    let active = true;

    async function restore() {
      const user = await authService.validateSession();
      if (!active) return;
      setCurrentUser(user);
      setBooting(false);
    }

    restore();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      setCurrentUser(null);
      setPage("dashboard");
      setAuthView("login");
      addToast("Your session expired. Please sign in again.", "warning");
    }

    window.addEventListener("meteriq:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("meteriq:unauthorized", handleUnauthorized);
  }, [addToast]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setPage("dashboard");
    addToast(`Signed in as ${user.fullName || user.email} (${user.role})`, "success");
  };

  const handleSignup = (user) => {
    setCurrentUser(user);
    setPage("dashboard");
    addToast(`Account created — signed in as ${user.fullName || user.email}`, "success");
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setPage("dashboard");
    setSelectedMeterId(null);
    addToast("Logged out successfully", "info");
  };

  const openMeter = useCallback((meter) => {
    const id = meter?.meter_id || meter?.id;
    if (!id) {
      addToast("This record does not have a meter identifier.", "error");
      return;
    }
    setSelectedMeterId(id);
    setPage("meter-detail");
  }, [addToast]);

  const openMeterById = useCallback((meterId) => {
    if (!meterId) return;
    setSelectedMeterId(meterId);
    setPage("meter-detail");
  }, []);

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return (
          <Dashboard
            onSelectMeter={openMeter}
            onNavigate={(targetPage) => setPage(targetPage)}
            currentUser={currentUser}
          />
        );
      case "meters":
        return <MetersPage onSelectMeter={openMeter} />;
      case "meter-detail":
        return (
          <MeterAnalysis
            meterId={selectedMeterId}
            currentUser={currentUser}
            onBack={() => setPage("meters")}
            onNavigateToInvestigations={() => setPage("investigations")}
            onShowToast={addToast}
          />
        );
      case "consumption":
        return <ConsumptionAnalytics />;
      case "anomalies":
        return (
          <AnomalyDetection
            currentUser={currentUser}
            onSelectMeterById={openMeterById}
            onNavigateToInvestigations={() => setPage("investigations")}
            onShowToast={addToast}
          />
        );
      case "forecasting":
        return <ForecastingPage />;
      case "investigations":
        return (
          <InvestigationsPage
            currentUser={currentUser}
            onSelectMeterById={openMeterById}
            onShowToast={addToast}
          />
        );
      case "reports":
        return <Reports onShowToast={addToast} />;
      case "data-quality":
        return <DataQualityPage />;
      case "meter-health":
        return <MeterHealth />;
      case "settings":
        return <Settings onShowToast={addToast} />;
      case "about":
        return <About />;
      default:
        return (
          <Dashboard
            onSelectMeter={openMeter}
            onNavigate={(targetPage) => setPage(targetPage)}
            currentUser={currentUser}
          />
        );
    }
  };

  if (booting) {
    return (
      <div className="loading-screen full-screen">
        <div className="loading-spinner" />
        <p className="loading-text">Restoring your MeterIQ session…</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <main className="login-main">
        {authView === "signup" ? (
          <Signup onSignup={handleSignup} onGoToLogin={() => setAuthView("login")} />
        ) : (
          <Login onLogin={handleLogin} onGoToSignup={() => setAuthView("signup")} />
        )}
      </main>
    );
  }

  return (
    <div className="app">
      <Sidebar
        page={page}
        setPage={setPage}
        onLogout={handleLogout}
        role={currentUser.role}
        user={currentUser}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />
      <main>
        <Header
          page={page}
          user={currentUser}
          role={currentUser.role}
          onToggleMobileMenu={() => setIsMobileMenuOpen((open) => !open)}
        />
        <div className={`page-content fade-in ${compactTables ? "compact-tables" : ""}`}>{renderPage()}</div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
