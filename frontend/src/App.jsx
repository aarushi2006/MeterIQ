import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ToastContainer, { useToast } from "./components/Toast";
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
import { meterService } from "./services/meterService";
import "./styles.css";

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [authView, setAuthView] = useState("login"); // "login" | "signup"
  const [page, setPage] = useState("dashboard");
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { toasts, addToast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setPage("dashboard");
    addToast(`Signed in as ${user.name} (${user.role})`, "success");
  };

  const handleSignup = (user) => {
    setCurrentUser(user);
    setAuthView("login");
    setPage("dashboard");
    addToast(`Account created — welcome, ${user.name}`, "success");
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setPage("dashboard");
    addToast("Logged out successfully", "info");
  };

  const openMeter = (meter) => {
    setSelectedMeter(meter);
    setPage("meter-detail");
    addToast(`Viewing Smart Meter ${meter.id} diagnostics`, "info");
  };

  const openMeterById = async (meterId) => {
    const meter = await meterService.getMeterById(meterId);
    if (meter) {
      openMeter(meter);
    } else {
      addToast(`Meter ${meterId} not found`, "error");
    }
  };

  const backToMeters = () => {
    setSelectedMeter(null);
    setPage("meters");
  };

  const renderPage = () => {
    if (loading) {
      return (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p className="loading-text">Initializing MeterIQ Analytics Engine...</p>
        </div>
      );
    }

    if (!currentUser) {
      return authView === "signup" ? (
        <Signup onSignup={handleSignup} onGoToLogin={() => setAuthView("login")} />
      ) : (
        <Login onLogin={handleLogin} onGoToSignup={() => setAuthView("signup")} />
      );
    }

    switch (page) {
      case "dashboard":
        return (
          <Dashboard
            onSelectMeter={openMeter}
            onSelectMeterById={openMeterById}
            onNavigate={(targetPage) => setPage(targetPage)}
          />
        );
      case "meters":
        return <MetersPage onSelectMeter={openMeter} />;
      case "meter-detail":
        return (
          <MeterAnalysis
            meter={selectedMeter}
            onBack={backToMeters}
            onNavigateToInvestigations={() => setPage("investigations")}
            onShowToast={addToast}
          />
        );
      case "consumption":
        return <ConsumptionAnalytics />;
      case "anomalies":
        return (
          <AnomalyDetection
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
            onSelectMeterById={openMeterById}
            onShowToast={addToast}
            currentUser={currentUser}
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
            onSelectMeterById={openMeterById}
            onNavigate={(targetPage) => setPage(targetPage)}
          />
        );
    }
  };

  return (
    <div className="app">
      {currentUser && (
        <Sidebar
          page={page}
          setPage={setPage}
          onLogout={handleLogout}
          role={currentUser.role}
          isMobileOpen={isMobileMenuOpen}
          setIsMobileOpen={setIsMobileMenuOpen}
        />
      )}
      <main className={!currentUser ? "login-main" : ""}>
        {currentUser && (
          <Header
            page={page}
            role={currentUser.role}
            onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          />
        )}
        <div className="page-content fade-in">{renderPage()}</div>
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
