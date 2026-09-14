import React, { useState } from "react";
import { useAuth } from "../lib/auth-context";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function LoginPage() {
  const { login, demoLogin } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setError("");
    setDemoLoading(true);
    try {
      await demoLogin();
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDemoLoading(false);
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
          <div className="eyebrow">The Grand Vista Luxury Villa</div>
          <h1>
            The next action
            <br />
            <em>is already here.</em>
          </h1>
          <p>
            Coordination intelligence for the architects, engineers, clients, and site teams moving high-end architectural construction forward.
          </p>
        </div>
        <div className="auth-aside-foot">
          <span className="status-pulse" /> Live Project Intelligence Active
        </div>
      </aside>
      <main className="auth-form-wrap">
        <div className="auth-form">
          <Link href="/" className="auth-back-link" data-testid="button-back-to-home">
            <ArrowLeft size={14} /> Back to Home
          </Link>
          <div className="eyebrow">The Grand Vista Villa Access</div>
          <h2>Welcome back</h2>
          <p className="auth-muted">Sign in to your luxury villa project workspace.</p>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}

          {/* SINGLE DEMO LOGIN BUTTON FOR VILLA PROJECT */}
          <button
            id="btn-launch-villa-demo"
            type="button"
            className="sso-button"
            onClick={handleDemo}
            disabled={demoLoading || loading}
            style={{
              background: "linear-end(135deg, #e27742 0%, #c45826 100%)",
              borderColor: "#e27742",
              fontWeight: 600,
            }}
          >
            {demoLoading ? (
              <Loader2 size={16} className="spinning" />
            ) : (
              <Sparkles size={16} />
            )}
            {demoLoading ? "Launching Villa Demo..." : "Launch Villa Project Demo"}
          </button>

          <div className="auth-divider">
            <span>or use your account</span>
          </div>
          <form onSubmit={handleSubmit}>
            <label>
              Email address
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="david.chen@apex-cm.com"
                required
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <div className="auth-password-field">
                <input
                  id="login-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  autoComplete="current-password"
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
              id="login-submit-btn"
              type="submit"
              className="button button-primary button-large"
              disabled={loading || demoLoading}
            >
              {loading ? (
                <Loader2 size={16} className="spinning" />
              ) : (
                <ArrowRight size={16} />
              )}
              {loading ? "Signing in..." : "Sign in to workspace"}
            </button>
          </form>
          <p className="auth-switch">
            No account?{" "}
            <Link href="/register" className="auth-link">
              Create a project workspace
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
