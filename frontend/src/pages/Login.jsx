import { useState } from "react";
import { authService } from "../services/authService";

export default function Login({ onLogin, onGoToSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const baseUrl = import.meta.env.BASE_URL || "/";
  const logoUrl = `${baseUrl.replace(/\/$/, "")}/meteriq-logo.png`;

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    setTimeout(() => {
      const result = authService.login(email, password, rememberMe);
      setIsSubmitting(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onLogin(result.user);
    }, 300);
  };

  const handleDemoLogin = (demoEmail) => {
    setIsSubmitting(true);
    setError("");
    setTimeout(() => {
      const result = authService.login(demoEmail, "meteriq123", rememberMe);
      setIsSubmitting(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onLogin(result.user);
    }, 200);
  };

  return (
    <div className="enterprise-login-page">
      <div className="login-dual-container">
        {/* Left: project context, not marketing copy */}
        <div className="login-brand-panel">
          <div className="brand-panel-content">
            <div className="brand-logo-frame">
              <img
                src={logoUrl}
                alt="MeterIQ — Explainable Smart Meter Analytics Platform"
                className="official-meteriq-logo"
              />
            </div>

            <div className="brand-quote-box">
              <p className="brand-tagline-text">Explainable Smart Meter Analytics Platform</p>
            </div>

            <div className="brand-features-list">
              <div className="bf-item">
                <span className="bf-icon">01</span>
                <div>
                  <strong>Anomaly & Risk Detection</strong>
                  <small>Identify unusual consumption patterns for investigation.</small>
                </div>
              </div>
              <div className="bf-item">
                <span className="bf-icon">02</span>
                <div>
                  <strong>Short-Term Load Forecasting</strong>
                  <small>Forecast demand from 15 minutes to 24 hours ahead.</small>
                </div>
              </div>
            </div>

            <div className="brand-panel-footer">
              <small className="motto-row">Thapar Institute of Engineering and Technology</small>
            </div>
          </div>
        </div>

        {/* Right: real login form */}
        <div className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="form-brand-header">
              <div className="mini-logo-wrap">
                <img src={logoUrl} alt="MeterIQ" className="form-mini-logo" />
              </div>
              <h1>Welcome back</h1>
              <p>Sign in to continue to MeterIQ</p>
            </div>

            {error && (
              <div className="login-error-pill">
                <span>!</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="input-group">
                <label htmlFor="login-email">Email</label>
                <div className="input-field-wrap">
                  <input
                    id="login-email"
                    type="email"
                    placeholder="name@meteriq.energy"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="input-group">
                <div className="label-with-action">
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() => setShowForgotModal(true)}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="input-field-wrap with-toggle">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="form-checkbox-row">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="checkmark" />
                  <span className="checkbox-label">Keep me signed in on this device</span>
                </label>
              </div>

              <button type="submit" className="submit-login-btn" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="btn-spinner-wrap">
                    <span className="mini-spinner" /> Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="auth-switch-line">
              Don't have an account?{" "}
              <button type="button" className="auth-switch-link" onClick={onGoToSignup}>
                Sign up
              </button>
            </p>

            <div className="demo-switch-divider">
              <span>Demo Access</span>
            </div>

            <div className="demo-login-grid">
              <button
                type="button"
                className="demo-card-btn supervisor"
                onClick={() => handleDemoLogin("yashit.supervisor@meteriq.energy")}
                disabled={isSubmitting}
              >
                <div className="demo-avatar">SV</div>
                <div className="demo-text">
                  <strong>Supervisor</strong>
                  <small>Demo access · Yashit Arora</small>
                </div>
                <span className="demo-arrow">→</span>
              </button>

              <button
                type="button"
                className="demo-card-btn analyst"
                onClick={() => handleDemoLogin("aarushi.analyst@meteriq.energy")}
                disabled={isSubmitting}
              >
                <div className="demo-avatar analyst">DA</div>
                <div className="demo-text">
                  <strong>Data Analyst</strong>
                  <small>Demo access · Aarushi Gahlawat</small>
                </div>
                <span className="demo-arrow">→</span>
              </button>
            </div>

            <p className="prototype-footnote">
              Prototype environment · Authentication is local to this browser
            </p>
          </div>
        </div>
      </div>

      {showForgotModal && (
        <div className="modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="modal-card mini-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Password recovery</h3>
              <button className="modal-close" onClick={() => setShowForgotModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                Password reset isn't available in this prototype — there's no backend to send
                reset emails from yet. Use a demo account above, or sign up for a new local account.
              </p>
            </div>
            <div className="modal-footer">
              <button className="primary" onClick={() => setShowForgotModal(false)}>
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
