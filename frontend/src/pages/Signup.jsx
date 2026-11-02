import { useState } from "react";
import { authService } from "../services/authService";

export default function Signup({ onSignup, onGoToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("analyst");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const baseUrl = import.meta.env.BASE_URL || "/";
  const logoUrl = `${baseUrl.replace(/\/$/, "")}/meteriq-logo.png`;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    setTimeout(() => {
      const result = authService.signup({ name, email, password, confirmPassword, role });
      setIsSubmitting(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      setTimeout(() => onSignup(result.user), 700);
    }, 300);
  };

  return (
    <div className="enterprise-login-page">
      <div className="login-dual-container">
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
              <h2 className="brand-quote-heading">Create your MeterIQ account</h2>
              <p className="brand-tagline-text">Choose the role that matches how you'll use the platform.</p>
            </div>

            <div className="brand-features-list">
              <div className="bf-item">
                <span className="bf-icon">01</span>
                <div>
                  <strong>Supervisor</strong>
                  <small>Reviews flagged meters and decides on field investigations.</small>
                </div>
              </div>
              <div className="bf-item">
                <span className="bf-icon">02</span>
                <div>
                  <strong>Data Analyst</strong>
                  <small>Explores consumption trends and forecasting model output.</small>
                </div>
              </div>
            </div>

            <div className="brand-panel-footer">
              <div className="creators-row">
                <span>Project Team:</span>
                <b>Yashit Arora (1024160006) · Aarushi Gahlawat (1024160008)</b>
              </div>
              <small className="motto-row">Thapar Institute of Engineering and Technology</small>
            </div>
          </div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-wrapper">
            <div className="form-brand-header">
              <div className="mini-logo-wrap">
                <img src={logoUrl} alt="MeterIQ" className="form-mini-logo" />
              </div>
              <h1>Create your MeterIQ account</h1>
              <p>Set up prototype access to the analytics console</p>
            </div>

            {error && (
              <div className="login-error-pill">
                <span>!</span> {error}
              </div>
            )}

            {success && (
              <div className="login-success-pill">
                <span>✓</span> Account created — signing you in...
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="input-group">
                <label htmlFor="signup-name">Full Name</label>
                <div className="input-field-wrap">
                  <input
                    id="signup-name"
                    type="text"
                    placeholder="Your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setPassword(e.target.value)}
                    required
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
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signup-role">Role</label>
                <div className="input-field-wrap">
                  <select
                    id="signup-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="role-select"
                  >
                    <option value="supervisor">Supervisor</option>
                    <option value="analyst">Data Analyst</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="submit-login-btn" disabled={isSubmitting || success}>
                {isSubmitting ? (
                  <span className="btn-spinner-wrap">
                    <span className="mini-spinner" /> Creating account...
                  </span>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <p className="auth-switch-line">
              Already have an account?{" "}
              <button type="button" className="auth-switch-link" onClick={onGoToLogin}>
                Login
              </button>
            </p>

            <p className="prototype-footnote">
              Prototype environment · Authentication is local to this browser
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
