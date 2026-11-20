import { useState } from "react";
import { authService } from "../services/authService";

export default function Signup({ onSignup, onGoToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const baseUrl = import.meta.env.BASE_URL || "/";
  const logoUrl = `${baseUrl.replace(/\/$/, "")}/meteriq-logo.png`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await authService.signup({
        name: name.trim(),
        email: email.trim(),
        password,
        confirmPassword,
      });
      onSignup(user);
    } catch (err) {
      setError(err.message || "Account creation failed.");
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
                alt="MeterIQ — Explainable Smart Meter Analytics Platform"
                className="official-meteriq-logo"
              />
            </div>

            <h1 className="brand-quote-heading">Create your MeterIQ account</h1>
            <p className="brand-tagline-text">
              New accounts are created with the Analyst role by the server. Analysts
              can explore analytics and add investigation notes.
            </p>

            <div className="brand-features-list">
              <div className="bf-item">
                <span className="bf-icon">01</span>
                <div>
                  <strong>Analyst</strong>
                  <small>Explore meter data, anomaly indicators, forecasts, and reports; annotate cases.</small>
                </div>
              </div>
              <div className="bf-item">
                <span className="bf-icon">02</span>
                <div>
                  <strong>Supervisor</strong>
                  <small>Provisioned by an administrator. Creates, assigns, updates, and closes cases.</small>
                </div>
              </div>
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
              <span className="eyebrow">NEW ACCOUNT</span>
              <h1>Create your account</h1>
              <p>Registration creates an analyst account. No role selection is required.</p>
            </div>

            {error && (
              <div className="login-error-pill" role="alert">
                <span className="error-icon">!</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="input-group">
                <label htmlFor="signup-name">Full Name</label>
                <div className="input-field-wrap">
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="Your full name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signup-email">Email</label>
                <div className="input-field-wrap">
                  <input
                    id="signup-email"
                    type="email"
                    placeholder="name@meteriq.energy"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signup-password">Password</label>
                <div className="input-field-wrap">
                  <input
                    id="signup-password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signup-confirm">Confirm Password</label>
                <div className="input-field-wrap">
                  <input
                    id="signup-confirm"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button type="submit" className="submit-login-btn" disabled={isSubmitting}>
                {isSubmitting ? "Creating account…" : "Create Account"}
              </button>
            </form>

            <p className="auth-switch-line">
              Already have an account?{" "}
              <button type="button" className="auth-switch-link" onClick={onGoToLogin}>
                Sign in
              </button>
            </p>

            <p className="prototype-footnote">
              The server assigns the Analyst role to all public signups. Elevated
              roles must be provisioned directly in the user database by an administrator.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
