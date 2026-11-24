import { useState } from "react";
import { authService } from "../services/authService";

export default function Login({ onLogin, onGoToSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const baseUrl = import.meta.env.BASE_URL || "/";
  const logoUrl = `${baseUrl.replace(/\/$/, "")}/meteriq-logo.png`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await authService.login(email.trim(), password, rememberMe);
      onLogin(user);
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="enterprise-login-page">
      <div className="login-bg-overlay" />
      <div className="login-dual-container">
        <section className="login-brand-panel">
          <div className="brand-panel-content">
            <div className="brand-logo-frame">
              <img
                src={logoUrl}
                alt="MeterIQ Smart Meter Analytics"
                className="official-meteriq-logo"
              />
            </div>

            <h1 className="brand-quote-heading">Intelligence for the Energy Grid</h1>
            <p className="brand-tagline-text">
              Explainable smart-meter analytics for consumption monitoring,
              anomaly review, and short-term load forecasting.
            </p>

            <div className="brand-features-list">
              <Feature
                number="01"
                title="Anomaly Detection"
                description="Statistical and multivariate indicators highlight unusual consumption for human review — not automatic theft determinations."
              />
              <Feature
                number="02"
                title="Load Forecasting"
                description="Chronologically validated short-term demand predictions with a baseline comparison."
              />
              <Feature
                number="03"
                title="Case Investigations"
                description="Supervisors create, assign, annotate, and close investigation cases; analysts review and add evidence."
              />
            </div>

            <div className="brand-panel-footer">
              <div className="brand-panel-footer-line">
                Thapar Institute of Engineering and Technology
              </div>
              <small className="motto-row">UCS503 · MeterIQ Project</small>
            </div>
          </div>
        </section>

        <section className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="form-brand-header">
              <span className="eyebrow">METERIQ PORTAL</span>
              <h1>Welcome back</h1>
              <p>Sign in with your MeterIQ account. Roles are assigned by the server.</p>
            </div>

            {error && (
              <div className="login-error-pill" role="alert">
                <span className="error-icon">!</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="input-group">
                <label htmlFor="login-email">Work Email</label>
                <div className="input-field-wrap">
                  <input
                    id="login-email"
                    type="email"
                    placeholder="name@meteriq.energy"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div className="input-group">
                <div className="label-with-action">
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() => setShowHelp(true)}
                  >
                    Need help?
                  </button>
                </div>
                <div className="input-field-wrap with-toggle">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-password-btn"
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <label className="checkbox-container">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                Keep me signed in on this device
              </label>

              <button type="submit" className="submit-login-btn" disabled={isSubmitting}>
                {isSubmitting ? "Signing in…" : "Sign In to Portal"}
              </button>
            </form>

            <p className="auth-switch-line">
              New user?{" "}
              <button type="button" className="auth-switch-link" onClick={onGoToSignup}>
                Create an account
              </button>
            </p>

            <p className="prototype-footnote">
              Access is authenticated against the MeterIQ API. Public signup creates
              an analyst account; supervisor access is provisioned by an administrator.
            </p>
          </div>
        </section>
      </div>

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="modal-card mini-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Account access</h3>
              <button className="modal-close" onClick={() => setShowHelp(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Password reset is not implemented by this deployment's API. Contact
                your MeterIQ administrator to reset credentials or to request a
                supervisor role.
              </p>
            </div>
            <div className="modal-footer">
              <button className="primary" onClick={() => setShowHelp(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Feature({ number, title, description }) {
  return (
    <div className="bf-item">
      <span className="bf-icon">{number}</span>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </div>
  );
}
