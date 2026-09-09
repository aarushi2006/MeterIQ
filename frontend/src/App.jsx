import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ToastContainer, { useToast } from "./components/Toast";
import Dashboard from "./pages/Dashboard";
import MeterAnalysis from "./pages/MeterAnalysis";
import MeterHealth from "./pages/MeterHealth";
import AlertsPage from "./pages/AlertsPage";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import About from "./pages/About";
import { meters } from "./data/mockData";
import "./styles.css";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [selectedMeter, setSelectedMeter] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toasts, addToast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const openMeter = (meter) => {
    setSelectedMeter(meter);
    setPage("analysis");
    addToast(`Viewing meter ${meter.id}`, "info");
  };

  const openMeterById = (id) => {
    const meter = meters.find((m) => m.id === id);
    if (meter) openMeter(meter);
  };

  const backToDashboard = () => {
    setSelectedMeter(null);
    setPage("dashboard");
  };

  const renderPage = () => {
    if (loading) {
      return (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <p>Loading MeterIQ...</p>
        </div>
      );
    }

    switch (page) {
      case "dashboard":
        return <Dashboard onSelectMeter={openMeter} onSelectMeterById={openMeterById} />;
      case "analysis":
        return selectedMeter ? (
          <MeterAnalysis meter={selectedMeter} onBack={backToDashboard} />
        ) : (
          <Dashboard onSelectMeter={openMeter} onSelectMeterById={openMeterById} />
        );
      case "health":
        return <MeterHealth />;
      case "alerts":
        return <AlertsPage />;
      case "reports":
        return <Reports />;
      case "settings":
        return <Settings />;
      case "about":
        return <About />;
      default:
        return <Dashboard onSelectMeter={openMeter} onSelectMeterById={openMeterById} />;
    }
  };

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} />
      <main>
        <Header page={page} />
        <div className="page-content fade-in">
          {renderPage()}
        </div>
      </main>
      <ToastContainer toasts={toasts} />
    </div>
  );
}
