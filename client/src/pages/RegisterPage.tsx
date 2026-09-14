import React, { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function RegisterPage() {
  const { register } = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [projectName, setProjectName] = useState("");
  const [role, setRole] = useState("admin");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const features = [
    "Multi-stakeholder RACI matrix & access control",
    "Automated blast radius tracing across all trades",
    "Grounded AI Copilot for project memory & decisions",
    "Integrated change orders & live approvals workflow",
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password, projectName, role);
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link href="/" className="brand-mark brand-mark-dark">
          <span className="brand-symbol">
            <span />
            <span />
            <span />
          </span>
          <span>
            <strong>coordination</strong>
            <small>intelligence</small>
          </span>
        </Link>
        <div>
          <div className="eyebrow">Enterprise Onboarding</div>
          <h1>
            Control the ripple
            <br />
            <em>before it starts.</em>
          </h1>
          <p>
            Create a dedicated coordination workspace for your stakeholders, actions, approvals, dependencies, and persistent project memory.
          </p>
          <ul className="auth-feature-list">
            {features.map((feature) => (
              <li key={feature}>
                <CheckCircle2 size={15} />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-aside-foot">
          <span className="status-pulse" /> Live Project Intelligence Active
        </div>
      </aside>
      <main className="auth-form-wrap">
        <div className="auth-form">
          <Link href="/" className="auth-back-link" data-testid="button-register-back-to-home">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <div className="eyebrow">New workspace</div>
          <h2>Create your account</h2>
          <p className="auth-muted">Set up a project workspace in seconds.</p>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ marginTop: "16px" }}>
            <label>
              Full name
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="David Chen"
                required
                autoComplete="name"
              />
            </label>
            <label>
              Work email
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="david.chen@apex-cm.com"
                required
                autoComplete="email"
              />
            </label>
            <label>
              Project name
              <input
                id="reg-project"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="The Grand Vista Luxury Villa"
                autoComplete="organization"
              />
            </label>
            <label>
              Your Project Role &amp; Discipline
              <select
                id="reg-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  height: "42px",
                  borderRadius: "8px",
                  border: "1px solid hsl(var(--border))",
                  padding: "0 12px",
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                  fontSize: "13px",
                  fontWeight: 500,
                  marginTop: "6px",
                  width: "100%",
                }}
              >
                <option value="admin">Project Delivery Manager / PM</option>
                <option value="owner">Client / Property Owner</option>
                <option value="architect">Principal Architect</option>
                <option value="engineer">Principal Structural Engineer</option>
                <option value="contractor">General Contractor / Site Super</option>
                <option value="interior">Lead Interior Designer</option>
                <option value="mep">MEP &amp; Smart Systems Director</option>
              </select>
            </label>
            <label>
              Password (min 6 characters)
              <div className="auth-password-field">
                <input
                  id="reg-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
                  autoComplete="new-password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <button
              id="reg-submit-btn"
              type="submit"
              className="button button-primary button-large"
              disabled={loading}
              style={{ marginTop: "12px" }}
            >
              {loading ? (
                <Loader2 size={16} className="spinning" />
              ) : (
                <ArrowRight size={16} />
              )}
              {loading ? "Creating workspace..." : "Create project workspace"}
            </button>
          </form>

          <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <p className="auth-switch">
              Already have an account?{" "}
              <Link href="/login" className="auth-link">
                Sign in
              </Link>
            </p>
            <p className="auth-switch">
              Want to see a working project?{" "}
              <Link href="/login" className="auth-link" style={{ fontWeight: 600 }}>
                Explore Villa Demo →
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
