import { type ButtonHTMLAttributes, type ReactNode, useState, useRef, useEffect } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bot,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock,
  Compass,
  Clock3,
  ExternalLink,
  FileCheck2,
  Filter,
  GitBranch,
  Layers,
  LayoutDashboard,
  Link2,
  ListChecks,
  Lock,
  LogIn,
  Mail,
  Menu,
  MessageSquare,
  Network,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  Link,
  Route,
  Switch,
  useLocation,
  useParams,
  Router as WouterRouter,
} from "wouter";
import {
  getGetChangeImpactQueryKey,
  useAcknowledgeAlert,
  useAnalyzeChangeImpact,
  useAskProject,
  useCreateChange,
  useGetChangeImpact,
  useGetDailyBriefing,
  useGetProjectOverview,
  useListActions,
  useListActivities,
  useListAlerts,
  useListApprovals,
  useListChanges,
  useListDependencies,
  useListMemoryEntries,
  useListStakeholders,
  useUpdateAction,
  useUpdateApproval,
} from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DependencyGraph } from "@/components/dependency-graph";
import { RaciMatrix } from "@/components/raci-matrix";
import { FormattedMessage } from "@/components/formatted-message";
import { SignalIngestionModal } from "@/components/signal-ingestion-modal";
import { StakeholderDrawer } from "@/components/stakeholder-drawer";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import api, {
  API_BASE,
  safeParseResponse,
  adoptChangeActions,
  createAction,
  createActivity,
  createApproval,
  createDependency,
  createMemory,
  createStakeholder,
  deleteActivity,
  markAllAlertsRead,
  updateActivity,
} from "@/lib/api-custom";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 3000,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const navGroups: {
  label: string;
  items: [string, string, typeof LayoutDashboard][];
}[] = [
  {
    label: "Control room",
    items: [
      ["/dashboard", "Overview", LayoutDashboard],
      ["/activities", "Activities", ListChecks],
      ["/dependencies", "Dependencies", GitBranch],
      ["/changes", "Changes", Zap],
    ],
  },
  {
    label: "Coordination",
    items: [
      ["/stakeholders", "Stakeholders", Users],
      ["/approvals", "Approvals", FileCheck2],
      ["/actions", "My actions", Target],
      ["/alerts", "Alerts", Bell],
    ],
  },
  {
    label: "Project intelligence",
    items: [
      ["/memory", "Project memory", Network],
      ["/ask", "Ask the project", MessageSquare],
    ],
  },
];

function initials(name = "") {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "—"
  );
}

function formatDate(value?: string) {
  if (!value) return "No date";
  if (value.toLowerCase().includes("today") || value.toLowerCase().includes("ago")) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function statusTone(value = "") {
  const v = value.toLowerCase();
  if (
    v.includes("block") ||
    v.includes("risk") ||
    v.includes("overdue") ||
    v.includes("reject") ||
    v.includes("critical")
  )
    return "danger";
  if (
    v.includes("progress") ||
    v.includes("review") ||
    v.includes("pending") ||
    v.includes("high") ||
    v.includes("medium")
  )
    return "amber";
  if (
    v.includes("complete") ||
    v.includes("approve") ||
    v.includes("on track") ||
    v.includes("active") ||
    v.includes("resolved")
  )
    return "teal";
  return "slate";
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={`pill pill-${tone}`}
      data-testid={`status-${String(children).toLowerCase().replace(/\s/g, "-")}`}
    >
      {children}
    </span>
  );
}

function Avatar({ name, color = "orange" }: { name?: string; color?: string }) {
  return (
    <span
      className={`avatar avatar-${color}`}
      data-testid={`avatar-${initials(name)}`}
    >
      {initials(name)}
    </span>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-label="Loading" />;
}

function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={`button button-${variant} pressable ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading reveal">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand-mark ${dark ? "brand-mark-dark" : ""}`}
      data-testid="link-brand-home"
    >
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
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout, switchRole, demoLogin } = useAuth();
  const [open, setOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showNotificationPopover, setShowNotificationPopover] = useState(false);
  const qc = useQueryClient();
  const acknowledge = useAcknowledgeAlert();
  const { data: alertsData } = useListAlerts();
  const { data: overviewData } = useGetProjectOverview();
  const unreadAlerts = (alertsData ?? []).filter(
    (a: any) => !a.acknowledged,
  ).length;

  const projectName =
    overviewData?.project?.name ||
    (user?.email === "david.chen@apex-cm.com"
      ? "The Grand Vista Luxury Villa"
      : "My Project Workspace");
  const isDemo =
    (overviewData?.project as any)?.isDemo ??
    (user?.email === "david.chen@apex-cm.com");

  const active = (path: string) =>
    location === path || (path !== "/dashboard" && location.startsWith(path));

  const handleSwitchToDemo = async () => {
    await demoLogin();
    qc.invalidateQueries();
    setLocation("/dashboard");
  };

  return (
    <div className="app-shell">
      {/* Mobile Drawer Backdrop */}
      {open && (
        <div
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close menu overlay"
        />
      )}
      {/* Sidebar */}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Logo dark />
          <button
            className="mobile-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            data-testid="button-close-menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="project-switcher" data-testid="button-project-switcher">
          <span className="project-icon">
            <Building2 size={16} />
          </span>
          <span>
            <b>{projectName}</b>
            <small>{isDemo ? "Grand Vista Demo Workspace" : "Active Project Workspace"}</small>
          </span>
          <ChevronDown size={15} />
        </div>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map(([path, label, Icon]) => (
                <Link
                  key={path}
                  href={path}
                  onClick={() => setOpen(false)}
                  className={`nav-item ${active(path) ? "nav-item-active" : ""}`}
                  data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {label === "Alerts" && unreadAlerts > 0 && (
                    <span className="nav-count">{unreadAlerts}</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-pulse" />
            Live coordination layer
          </div>
          <div className="user-chip">
            <div
              className="user-chip-info"
              onClick={() => setShowProfileModal(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flex: 1, minWidth: 0 }}
              title="Click to view profile card"
              data-testid="button-open-profile-sidebar"
            >
              <Avatar name={user?.name || "David Chen"} color="yellow" />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <b>{user?.name || "David Chen"}</b>
                <small>{user?.role?.toUpperCase() || "ADMIN / PM"}</small>
              </span>
            </div>
            <button
              onClick={() => setShowLogoutModal(true)}
              aria-label="Sign out"
              title="Sign out"
              data-testid="button-sign-out"
            >
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="main-column">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            data-testid="button-open-menu"
          >
            <Menu size={20} />
          </button>
          <div className="topbar-left-group">
            <div className="breadcrumb">
              <span>{projectName}</span>
              <ArrowRight size={13} />
              <b>
                {navGroups
                  .flatMap((g) => g.items)
                  .find(([path]) => active(path))?.[1] ?? "Workspace"}
              </b>
            </div>
          </div>

          <div className="topbar-actions">
            {isDemo ? (
              /* Demo Stakeholder / Role Switcher for The Grand Vista Luxury Villa */
              <div className="role-switcher-container" title="Switch stakeholder persona to test Role-Based Access Control">
                <span className="role-switcher-label">
                  <Users size={13} />
                  <b>Demo Persona:</b>
                </span>
                <select
                  className="role-select"
                  value={user?.role || "admin"}
                  onChange={async (e) => {
                    await switchRole(e.target.value);
                    qc.invalidateQueries();
                  }}
                  data-testid="select-role-switcher"
                >
                  <option value="admin">David Chen (PM / Admin)</option>
                  <option value="owner">Marcus Vance (Owner / Client)</option>
                  <option value="architect">Elena Rostova (Lead Architect)</option>
                  <option value="engineer">Rajesh Patel (Structural Eng)</option>
                  <option value="contractor">Carlos Gomez (General Contractor)</option>
                  <option value="interior">Sophia Laurent (Interior Designer)</option>
                  <option value="mep">Tariq Mansoor (MEP Director)</option>
                </select>
              </div>
            ) : (
              /* Real Authenticated User Badge & Demo Mode Quick Access */
              <div className="real-user-badge-group">
                <div className="role-user-badge" title={`Signed in as ${user?.name} (${user?.role})`}>
                  <span className="role-pill-active">
                    <ShieldAlert size={12} />
                    <span>{user?.role?.toUpperCase()}</span>
                  </span>
                  <span className="user-name-tag">{user?.name}</span>
                </div>
                <button
                  onClick={handleSwitchToDemo}
                  className="button button-outline button-xs"
                  title="Explore The Grand Vista Luxury Villa demo project"
                  data-testid="button-switch-to-demo"
                >
                  Explore Demo
                </button>
              </div>
            )}

            <Link
              href="/ask"
              className="command-search"
              data-testid="link-command-search"
            >
              <Search size={16} />
              <span>Ask the project</span>
              <kbd>⌘ K</kbd>
            </Link>
            <button
              className={`icon-button ${unreadAlerts > 0 ? "has-dot" : ""}`}
              onClick={() => setShowNotificationPopover((prev) => !prev)}
              aria-label="Toggle notifications"
              title="Toggle notifications panel"
              data-testid="link-topbar-alerts"
            >
              <Bell size={18} />
            </button>
            <div
              className="user-topbar-badge"
              title={`Click to view profile for ${user?.name} (${user?.role})`}
              onClick={() => setShowProfileModal(true)}
              style={{ cursor: "pointer" }}
              data-testid="button-open-profile-topbar"
            >
              <Avatar name={user?.name || "David Chen"} color="orange" />
              <span className="user-topbar-name">{user?.name?.split(" ")[0] || "David"}</span>
            </div>
          </div>
        </header>

        {/* Notifications Popover Dropdown */}
        {showNotificationPopover && (
          <div
            className="notification-popover-backdrop"
            onClick={() => setShowNotificationPopover(false)}
          >
            <div
              className="notification-popover-card"
              onClick={(e) => e.stopPropagation()}
              data-testid="popover-notification-panel"
            >
              <div className="notification-popover-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Bell size={16} className="teal-text" />
                  <b>Coordination Signals</b>
                  <span className="count-pill">{unreadAlerts} unread</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {unreadAlerts > 0 && (
                    <button
                      className="button button-ghost button-xs"
                      onClick={async () => {
                        await markAllAlertsRead();
                        qc.invalidateQueries({ queryKey: ["alerts"] });
                        qc.invalidateQueries();
                      }}
                      title="Acknowledge all signals"
                    >
                      <Check size={13} /> Mark all read
                    </button>
                  )}
                  <button
                    className="icon-button-xs"
                    onClick={() => setShowNotificationPopover(false)}
                    aria-label="Close notifications"
                    style={{ background: "transparent", border: "none", cursor: "pointer" }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div className="notification-popover-list">
                {(alertsData ?? []).length > 0 ? (
                  (alertsData ?? []).slice(0, 5).map((al: any) => (
                    <div
                      key={al.id}
                      className={`notification-popover-item ${al.acknowledged ? "is-read" : "is-unread"}`}
                    >
                      <div className="notification-popover-item-content">
                        <div className="notification-popover-item-title">
                          <span className={`status-dot ${statusTone(al.severity)}`} />
                          <b>{al.title}</b>
                        </div>
                        <p>{al.description}</p>
                        <small>{formatDate(al.createdAt)} · {al.severity}</small>
                      </div>
                      {!al.acknowledged && (
                        <button
                          className="button button-outline button-xs"
                          onClick={async () => {
                            try {
                              await acknowledge.mutateAsync({ alertId: al.id });
                            } catch {
                              await api.acknowledgeAlert(al.id);
                            }
                            qc.invalidateQueries({ queryKey: ["alerts"] });
                            qc.invalidateQueries();
                          }}
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="notification-empty">
                    <CheckCircle2 size={24} className="teal-text" />
                    <p>All clear! No coordination warnings.</p>
                  </div>
                )}
              </div>

              <div className="notification-popover-footer">
                <Link
                  href="/alerts"
                  className="button button-ghost button-sm"
                  onClick={() => setShowNotificationPopover(false)}
                  style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 6 }}
                >
                  Open Alerts Center <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
        )}

        <main className="page-content">{children}</main>

        {/* Mobile Thumb Dock */}
        <div className="mobile-bottom-dock">
          <nav className="dock-nav">
            <Link
              href="/dashboard"
              className={`dock-item ${active("/dashboard") ? "dock-active" : ""}`}
            >
              <LayoutDashboard size={18} />
              <span>Control</span>
            </Link>
            <Link
              href="/activities"
              className={`dock-item ${active("/activities") ? "dock-active" : ""}`}
            >
              <ListChecks size={18} />
              <span>Work</span>
            </Link>
            <Link
              href="/dependencies"
              className={`dock-item ${active("/dependencies") ? "dock-active" : ""}`}
            >
              <GitBranch size={18} />
              <span>Graph</span>
            </Link>
            <Link
              href="/changes"
              className={`dock-item ${active("/changes") ? "dock-active" : ""}`}
            >
              <Zap size={18} />
              <span>Changes</span>
            </Link>
            <Link
              href="/ask"
              className={`dock-item ${active("/ask") ? "dock-active" : ""}`}
            >
              <MessageSquare size={18} />
              <span>Copilot</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()} data-testid="modal-confirm-logout">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.15)",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Are you sure?</h3>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "hsl(var(--muted-foreground))" }}>
                  Confirm signing out of your account
                </p>
              </div>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: "hsl(var(--foreground))", margin: "0 0 24px" }}>
              Are you sure you want to log out of <strong>{projectName}</strong>? Your active session credentials and workspace state will be securely closed.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setShowLogoutModal(false)}
                data-testid="button-cancel-logout"
              >
                Cancel
              </button>
              <button
                type="button"
                className="button"
                style={{ background: "#dc2626", color: "#ffffff", borderColor: "#dc2626" }}
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                  setLocation("/");
                }}
                data-testid="button-confirm-logout"
              >
                <LogIn size={15} style={{ transform: "rotate(180deg)" }} />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Card Modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="profile-card-modal" onClick={(e) => e.stopPropagation()} data-testid="modal-profile-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ position: "relative" }}>
                  <Avatar name={user?.name || "User"} color="orange" />
                  <span style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: "#22c55e",
                    border: "2px solid hsl(var(--card))"
                  }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{user?.name || "User"}</h3>
                  <span style={{
                    display: "inline-block",
                    marginTop: 4,
                    padding: "2px 8px",
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    background: "rgba(59, 130, 246, 0.15)",
                    color: "#3b82f6"
                  }}>
                    {user?.role?.toUpperCase() || "ADMIN"}
                  </span>
                </div>
              </div>
              <button
                className="button button-ghost button-xs"
                onClick={() => setShowProfileModal(false)}
                aria-label="Close profile card"
                data-testid="button-close-profile"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, background: "hsl(var(--secondary) / 0.5)", padding: 16, borderRadius: 10, border: "1px solid hsl(var(--border))", marginBottom: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Email Address</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "hsl(var(--foreground))" }}>{user?.email || "No email registered"}</span>
              </div>
              <div style={{ height: 1, background: "hsl(var(--border))" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Trade Role & Responsibility</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "hsl(var(--foreground))", textTransform: "capitalize" }}>
                  {user?.role === "admin" ? "Project Delivery Director / Admin (Full Authority)" :
                   user?.role === "architect" ? "Principal Architect & Design Lead (Drawing & Material Sign-off)" :
                   user?.role === "engineer" ? "Principal Structural Engineer (Deflection & Anchor Calculations)" :
                   user?.role === "contractor" ? "General Contractor & Site Superintendent (Execution Lead)" :
                   user?.role === "interior" ? "Lead Interior Designer (Finish Specification & FF&E)" :
                   user?.role === "mep" ? "MEP & Automation Director (Boreholes & Smart Systems)" :
                   user?.role || "Team Member"}
                </span>
              </div>
              <div style={{ height: 1, background: "hsl(var(--border))" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Assigned Workspace Project</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "hsl(var(--foreground))" }}>
                  {projectName} {isDemo && <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>(Interactive Demo)</span>}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                Active SQLite Database Store
              </span>
              <button
                type="button"
                className="button button-outline button-sm"
                onClick={() => {
                  setShowProfileModal(false);
                  setShowLogoutModal(true);
                }}
                data-testid="button-profile-logout"
              >
                <ArrowRight size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Landing() {
  const [activeFeature, setActiveFeature] = useState(0);
  const featureLinks = ["/stakeholders", "/changes", "/approvals"];
  const features = [
    {
      title: "Know Who is Responsible for What",
      description:
        "Directory and interactive RACI responsibility matrix for all consultants, contractors, and owners.",
    },
    {
      title: "Know Who is Affected by a Change",
      description:
        "Dynamic graph ripple engine calculates delays, drafts action plans, and alerts downstream teams.",
    },
    {
      title: "Resolve Approvals & Unblock Flow",
      description:
        "Multi-stakeholder sign-off workflows that instantly unblock dependent tasks on approval.",
    },
  ];

  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const workflowSteps = [
    {
      stage: "Step 01 · Signal Ingestion",
      actor: "3D Site Laser Scan · Carlos Gomez",
      headline: "Cantilever slab sleeve offset (+120mm) detected on Level 2",
      body: "Field verification scan identified that the post-tensioned cantilever slab sleeve is displaced by 120mm from architectural datum. This immediately endangers the concealed MEP loops and 12-meter motorized glass pocket track anchors.",
      tags: ["Structural Superstructure", "Laser Scan Ingestion", "Critical Clash"],
      link: "/changes",
    },
    {
      stage: "Step 02 · Blast Radius Analysis",
      actor: "AI Blast Radius Engine · Gemini Grounded",
      headline: "Automated downstream impact calculated in 1.4 seconds",
      body: "Rather than waiting days for an RFI chain, the AI traces 4 affected work packages across 3 trades: hydronic radiant loop conduit layout (MEP), slimline sliding door head detail (Architectural), and the Level 2 concrete pour sequence.",
      tags: ["4 Packages Affected", "+7 to 10 Days Slip Prevented", "Auto-Drafted Actions"],
      link: "/changes",
    },
    {
      stage: "Step 03 · Multi-Trade Sign-off",
      actor: "Role-Based Authority Gate · Rajesh Patel & Elena Rostova",
      headline: "Fast-track digital authorization without WhatsApp confusion",
      body: "Elena Rostova (Principal Architect) and Rajesh Patel (Principal Structural Engineer) receive instant targeted submittals. Structural engineering recalculates load paths and approves revised coring with full audit compliance.",
      tags: ["RACI Enforced", "PE Certified", "Unblocks Pour Sequence"],
      link: "/approvals",
    },
    {
      stage: "Step 04 · Permanent Project Memory",
      actor: "Grounded Institutional Knowledge · Project Memory RAG",
      headline: "Immutable decision record preserved with citations for Copilot",
      body: "The resolution is permanently indexed into project memory. When anyone asks the Copilot 'What was the coring rule for the living room cantilever slab?', it answers accurately in plain English with verifiable citations.",
      tags: ["Zero Knowledge Loss", "Citations Indexed", "Copilot Ready"],
      link: "/memory",
    },
  ];

  const disciplinesList = [
    {
      role: "Principal Architect",
      name: "Elena Rostova",
      company: "Studio Rostova",
      scope: "Spatial datum, 12m motorized glass envelope, Italian travertine finishes & design intent harmony.",
      packages: 3,
      approvals: 2,
      status: "Reviewing Finish Details",
      icon: Compass,
      color: "teal",
    },
    {
      role: "Principal Structural Engineer",
      name: "Rajesh Patel",
      company: "Apex Engineering",
      scope: "Post-tensioned cantilever deflection, slab penetrations, seismic anchors & certified sign-offs.",
      packages: 3,
      approvals: 2,
      status: "Sign-Offs Active",
      icon: ShieldAlert,
      color: "blue",
    },
    {
      role: "MEP & Smart Systems Director",
      name: "Tariq Mansoor",
      company: "Aether MEP",
      scope: "Geothermal closed loop (8/8 boreholes), radiant heating manifolds & KNX home automation.",
      packages: 2,
      approvals: 1,
      status: "Coordinating Conduits",
      icon: Zap,
      color: "amber",
    },
    {
      role: "General Contractor / Super",
      name: "Carlos Gomez",
      company: "Vanguard Site Ops",
      scope: "Field execution, concrete pour staging, trade sequencing & submittal tracking on the ground.",
      packages: 4,
      approvals: 1,
      status: "Pour Staging Level 2",
      icon: Briefcase,
      color: "purple",
    },
    {
      role: "Lead Interior Designer",
      name: "Sophia Laurent",
      company: "Atelier Laurent",
      scope: "Roman Cross-Cut travertine alignment, custom architectural millwork & concealed shadow reveals.",
      packages: 2,
      approvals: 1,
      status: "Material Submittal OK",
      icon: Layers,
      color: "rose",
    },
    {
      role: "Client / Property Owner",
      name: "Marcus Vance",
      company: "Vance Holdings",
      scope: "Real-time project visibility, commercial milestones, change order concurring & high-level releases.",
      packages: 1,
      approvals: 2,
      status: "Briefings Monitored",
      icon: Building2,
      color: "emerald",
    },
  ];

  const faqs = [
    {
      q: "How does the Blast Radius engine trace downstream impact across trades?",
      a: "The engine maps the project's dependency graph across architectural, structural, and MEP work packages. When an item or datum shifts, it immediately traverses prerequisites and milestones to calculate schedule slip, affected trades, and recommended mitigation actions.",
    },
    {
      q: "How is the Project Memory Copilot different from standard ChatGPT?",
      a: "Standard AI models make generic guesses. The Coordination Intelligence Copilot is grounded strictly in your project's immutable memory — including site RFIs, signed change orders, meeting decisions, and active work packages — with verifiable citations for every answer.",
    },
    {
      q: "How does Role-Based Access Control work on construction sign-offs?",
      a: "Every stakeholder has designated authority levels in the RACI matrix. For example, a site contractor cannot approve structural engineering certifications, and an engineer cannot sign off on client commercial variations. Access rules are enforced server-side on every request.",
    },
    {
      q: "Can trade leads and site teams use this from mobile phones in the field?",
      a: "Yes. The entire platform is fully mobile-responsive with a native bottom dock, fast touch targets, and offline-resilient architecture so supervisors can acknowledge alerts and check next actions right on the slab.",
    },
  ];

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Logo />
        <div className="landing-links">
          <a href="#how-it-works">How it works</a>
          <a href="#workflow">Workflow</a>
          <a href="#disciplines">Disciplines</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="landing-actions">
          <Link
            href="/dashboard"
            className="button button-secondary pressable"
            data-testid="link-landing-demo"
          >
            <Sparkles size={14} className="amber-text" /> Enter Demo
          </Link>
          <Link
            href="/sign-in"
            className="button button-primary pressable"
            data-testid="link-landing-sign-in"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="landing-hero grid-blueprint">
        <div className="hero-copy reveal">
          <div className="status-tag">
            <span className="status-pulse" />
            Live coordination layer
          </div>
          <h1>
            Kill the coordination
            <br />
            <em>black hole nightmare.</em>
          </h1>
          <p>
            Too many people. Too many handoffs. Too little visibility.
            Coordination Intelligence connects stakeholders, activities,
            dependencies, approvals, and changes for luxury architectural construction so nothing slips into the void.
          </p>
          <div className="hero-cta">
            <Link
              href="/dashboard"
              className="button button-primary button-large pressable"
              data-testid="link-hero-demo"
            >
              Launch Villa Project Demo <ArrowRight size={17} />
            </Link>
            <Link
              href="/sign-in"
              className="button button-secondary button-large pressable"
              data-testid="link-hero-sign-in"
            >
              <LogIn size={16} /> Sign in
            </Link>
          </div>
          <div className="hero-note">
            <span className="mini-avatars">
              <Avatar name="David Chen" />
              <Avatar name="Elena Rostova" color="teal" />
              <Avatar name="Rajesh Patel" color="navy" />
            </span>
            <span>
              Used daily by architects, structural engineers, contractors &amp; villa owners
            </span>
          </div>
        </div>

        <div className="hero-visual reveal reveal-delay-2">
          <div className="visual-label">
            THE GRAND VISTA VILLA / CONTROL ROOM <span>10:15:42</span>
          </div>
          <div className="hero-board">
            <div className="board-top">
              <span>PROJECT HEALTH</span>
              <Pill tone="teal">On track</Pill>
            </div>
            <div className="board-progress">
              <strong>
                72<span>%</span>
              </strong>
              <div>
                <div className="progress-track">
                  <i style={{ width: "72%" }} />
                </div>
                <small>Cantilever superstructure &amp; envelope · Phase 2</small>
              </div>
            </div>
            <div className="signal-grid">
              <div>
                <b>02</b>
                <span>Blocked</span>
              </div>
              <div>
                <b>04</b>
                <span>Approvals</span>
              </div>
              <div>
                <b>15</b>
                <span>Dependencies</span>
              </div>
            </div>
            <div className="board-alert">
              <AlertTriangle size={15} />
              <span>
                <b>Cantilever slab sleeve clash (+120mm)</b> is holding MEP conduits and
                motorized pocket sliders.
              </span>
              <ArrowRight size={15} />
            </div>
            <div className="board-line">
              <span>
                <CircleDot size={13} />
                Next action
              </span>
              <b>Review revised cantilever penetration drawing</b>
              <Avatar name="Elena Rostova" color="teal" />
            </div>
          </div>
          <div className="float-card float-card-one">
            <Sparkles size={14} />
            <span>AI Briefing Ready</span>
            <b>2 critical handoffs need structural sign-off</b>
          </div>
          <div className="float-card float-card-two">
            <GitBranch size={14} />
            <span>Blast Radius Traced</span>
            <b>4 downstream activities affected</b>
          </div>
        </div>
      </section>

      {/* Live Moving Coordination Stream (Moving interactive component without changing landing page copy) */}
      <div className="landing-live-stream" data-testid="landing-live-stream">
        <div className="landing-stream-label">
          <span className="status-pulse" />
          <span>Live Coordination Stream</span>
        </div>
        <div className="landing-stream-track">
          <div className="landing-stream-chip">
            <ShieldAlert size={14} color="#3b82f6" />
            <span><strong>Structural Engineering:</strong> Master suite lintel deflection calculations verified by Rajesh Patel</span>
          </div>
          <div className="landing-stream-chip">
            <Sparkles size={14} color="#10b981" />
            <span><strong>Copilot Intelligence:</strong> 12m motorized glass laser cutting unblocked with 0 downstream clashes</span>
          </div>
          <div className="landing-stream-chip">
            <ActivityIcon size={14} color="#f59e0b" />
            <span><strong>MEP Rough-in:</strong> Geothermal loop 8/8 boreholes routed beneath courtyard grade</span>
          </div>
          <div className="landing-stream-chip">
            <CheckCircle2 size={14} color="#06b6d4" />
            <span><strong>Architectural Sign-off:</strong> Roman Cross-Cut Travertine approved for pool deck</span>
          </div>
          <div className="landing-stream-chip">
            <GitBranch size={14} color="#8b5cf6" />
            <span><strong>Blast Radius Engine:</strong> 4 downstream activities harmonized across trades</span>
          </div>
          {/* Duplicate set for seamless continuous marquee loop */}
          <div className="landing-stream-chip">
            <ShieldAlert size={14} color="#3b82f6" />
            <span><strong>Structural Engineering:</strong> Master suite lintel deflection calculations verified by Rajesh Patel</span>
          </div>
          <div className="landing-stream-chip">
            <Sparkles size={14} color="#10b981" />
            <span><strong>Copilot Intelligence:</strong> 12m motorized glass laser cutting unblocked with 0 downstream clashes</span>
          </div>
          <div className="landing-stream-chip">
            <ActivityIcon size={14} color="#f59e0b" />
            <span><strong>MEP Rough-in:</strong> Geothermal loop 8/8 boreholes routed beneath courtyard grade</span>
          </div>
          <div className="landing-stream-chip">
            <CheckCircle2 size={14} color="#06b6d4" />
            <span><strong>Architectural Sign-off:</strong> Roman Cross-Cut Travertine approved for pool deck</span>
          </div>
          <div className="landing-stream-chip">
            <GitBranch size={14} color="#8b5cf6" />
            <span><strong>Blast Radius Engine:</strong> 4 downstream activities harmonized across trades</span>
          </div>
        </div>
      </div>

      {/* Interactive Command Metrics Showcase */}
      <section className="landing-metrics-showcase">
        <div className="metrics-grid">
          <div className="metric-box">
            <div className="metric-icon-wrap amber">
              <Zap size={20} />
            </div>
            <div className="metric-number">0</div>
            <div className="metric-label">Unresolved Clashes</div>
            <p className="metric-sub">Real-time laser scan &amp; BIM collision detection before concrete pour</p>
          </div>
          <div className="metric-box">
            <div className="metric-icon-wrap teal">
              <GitBranch size={20} />
            </div>
            <div className="metric-number">100%</div>
            <div className="metric-label">Blast Radius Visibility</div>
            <p className="metric-sub">Immediate downstream dependency mapping across trades &amp; packages</p>
          </div>
          <div className="metric-box">
            <div className="metric-icon-wrap blue">
              <FileCheck2 size={20} />
            </div>
            <div className="metric-number">4.8×</div>
            <div className="metric-label">Faster Approval Gates</div>
            <p className="metric-sub">Direct role-based digital sign-offs replacing endless email &amp; chat threads</p>
          </div>
          <div className="metric-box">
            <div className="metric-icon-wrap purple">
              <Building2 size={20} />
            </div>
            <div className="metric-number">7+</div>
            <div className="metric-label">Unified Disciplines</div>
            <p className="metric-sub">Architects, structural engineers, MEP, fitout &amp; client aligned in real time</p>
          </div>
        </div>
      </section>

      <section className="landing-stats" id="signal">
        <div>
          <b>01</b>
          <span>Eliminate Information Silos</span>
          <p>
            WhatsApp site photos, consultant RFIs, and architectural revisions automatically synthesized into
            a single source of truth.
          </p>
        </div>
        <div>
          <b>02</b>
          <span>Automated Blast Radius Tracing</span>
          <p>
            When any architectural datum or material shifts, trace downstream ripple across
            structural and MEP trades before rework starts.
          </p>
        </div>
        <div>
          <b>03</b>
          <span>Grounded Project Copilot</span>
          <p>
            Ask natural questions and get answers with citations tied directly
            to immutable villa project memory.
          </p>
        </div>
      </section>

      <section className="landing-section" id="how-it-works">
        <div className="landing-section-intro">
          <div className="eyebrow">The coordination layer</div>
          <h2>
            Less chaos.
            <br />
            <span>Fewer delays.</span>
          </h2>
        </div>
        <div className="feature-list">
          {features.map((feature, index) => (
            <Link
              key={feature.title}
              href={featureLinks[index]}
              className={
                activeFeature === index
                  ? "feature-item feature-item-active"
                  : "feature-item"
              }
              onMouseEnter={() => setActiveFeature(index)}
              onFocus={() => setActiveFeature(index)}
              data-testid={`link-landing-feature-${index + 1}`}
            >
              <span className="feature-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      </section>

      {/* Interactive Workflow Section */}
      <section className="landing-workflow" id="workflow">
        <div className="landing-section-intro">
          <div className="eyebrow">Real-Time Coordination Loop</div>
          <h2>
            From site signal to sign-off
            <br />
            <span>in four seamless steps.</span>
          </h2>
          <p className="landing-intro-p">
            Follow how a real-world clash on The Grand Vista Villa is detected, traced, resolved, and committed to project memory.
          </p>
        </div>

        <div className="workflow-container">
          <div className="workflow-steps-nav">
            {workflowSteps.map((step, idx) => (
              <button
                key={idx}
                type="button"
                className={`workflow-step-btn ${activeWorkflowStep === idx ? "active" : ""}`}
                onClick={() => setActiveWorkflowStep(idx)}
                data-testid={`button-workflow-step-${idx + 1}`}
              >
                <div className="step-num">{String(idx + 1).padStart(2, "0")}</div>
                <div className="step-text">
                  <b>{step.stage.split(" · ")[1]}</b>
                  <small>{step.actor}</small>
                </div>
              </button>
            ))}
          </div>

          <div className="workflow-preview-card">
            <div className="preview-card-header">
              <div className="preview-badge">
                <span className="status-pulse" />
                {workflowSteps[activeWorkflowStep].stage}
              </div>
              <span className="preview-actor">{workflowSteps[activeWorkflowStep].actor}</span>
            </div>
            <h3 className="preview-title">{workflowSteps[activeWorkflowStep].headline}</h3>
            <p className="preview-body">{workflowSteps[activeWorkflowStep].body}</p>
            <div className="preview-highlights">
              {workflowSteps[activeWorkflowStep].tags.map((tag, tIdx) => (
                <span key={tIdx} className="preview-tag">
                  <CheckCircle2 size={12} /> {tag}
                </span>
              ))}
            </div>
            <div className="preview-action-row">
              <Link href={workflowSteps[activeWorkflowStep].link} className="button button-secondary">
                Inspect in Workspace <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stakeholder Disciplines Section */}
      <section className="landing-disciplines" id="disciplines">
        <div className="landing-section-intro">
          <div className="eyebrow">Multidisciplinary Command</div>
          <h2>
            Tailored radars for every lead.
            <br />
            <span>Unified visibility for all.</span>
          </h2>
          <p className="landing-intro-p">
            Each discipline gets a dedicated radar filtered strictly to their trade responsibilities, with full transparency across the entire project.
          </p>
        </div>

        <div className="disciplines-grid">
          {disciplinesList.map((disc) => (
            <div key={disc.name} className="discipline-card">
              <div className="discipline-header">
                <div className={`discipline-icon ${disc.color}`}>
                  <disc.icon size={18} />
                </div>
                <span className="discipline-status">{disc.status}</span>
              </div>
              <h4>{disc.role}</h4>
              <b className="discipline-name">{disc.name} · {disc.company}</b>
              <p className="discipline-scope">{disc.scope}</p>
              <div className="discipline-footer">
                <span><strong>{disc.packages}</strong> work packages</span>
                <span><strong>{disc.approvals}</strong> pending sign-offs</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="landing-faq" id="faq">
        <div className="landing-section-intro">
          <div className="eyebrow">Got Questions?</div>
          <h2>
            Frequently asked
            <br />
            <span>coordination questions.</span>
          </h2>
        </div>

        <div className="faq-list">
          {faqs.map((faq, fIdx) => (
            <div key={fIdx} className={`faq-item ${openFaq === fIdx ? "open" : ""}`}>
              <button
                type="button"
                className="faq-question"
                onClick={() => setOpenFaq(openFaq === fIdx ? null : fIdx)}
                data-testid={`button-faq-${fIdx + 1}`}
              >
                <span>{faq.q}</span>
                <ChevronDown size={18} className="faq-arrow" />
              </button>
              {openFaq === fIdx && (
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Enterprise CTA Banner */}
      <section className="landing-cta-banner">
        <div className="cta-banner-content">
          <div className="status-tag">
            <span className="status-pulse" />
            Enterprise-Ready Architecture
          </div>
          <h2>Kill the coordination black hole on your next high-stakes build.</h2>
          <p>
            Experience the live project workspace with real role-based permissions, automated blast radius analysis, and persistent Gemini AI copilot memory.
          </p>
          <div className="cta-banner-actions">
            <Link href="/dashboard" className="button button-primary button-large pressable" data-testid="link-cta-demo">
              <Sparkles size={16} /> Explore Villa Project Demo
            </Link>
            <Link href="/register" className="button button-secondary button-large pressable" data-testid="link-cta-register">
              Create Free Workspace <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <Logo />
        <span>
          Coordination Intelligence · The Grand Vista Luxury Villa Construction
        </span>
        <Link href="/sign-in" data-testid="link-footer-signin">
          Sign In to Workspace <ArrowRight size={15} />
        </Link>
      </footer>
    </div>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data, isLoading, isError } = useGetProjectOverview();
  const briefingQuery = useGetDailyBriefing();
  const { data: alerts = [] } = useListAlerts();
  const { data: activities = [] } = useListActivities();
  const [simulating, setSimulating] = useState(false);
  const [viewScope, setViewScope] = useState<"trade" | "workspace">("trade");
  const overview = data as any;
  const briefing = briefingQuery.data ?? overview?.briefing;

  const handleSimulateChange = async () => {
    setSimulating(true);
    try {
      const res = await fetch(`${API_BASE}/projects/current/changes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("coord_token") || ""}`,
        },
        body: JSON.stringify({
          title: "Cantilever slab sleeve clash detected (+120mm)",
          summary:
            "3D laser scan revealed 120mm offset on post-tensioned cantilever slab sleeve. MEP hydronic radiant loop conduits and motorized pocket slider track anchors require immediate recalibration.",
          severity: "critical",
        }),
      });
      const newChange = await safeParseResponse<any>(res);
      if (!res.ok) {
        throw new Error(newChange?.error || newChange?.message || `HTTP ${res.status}`);
      }
      qc.invalidateQueries();
      if (newChange?.id) {
        setLocation(`/changes/${newChange.id}`);
      }
    } catch (e: any) {
      alert("Failed to simulate change: " + e.message);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <Shell>
      {isLoading && (
        <div className="panel">
          <EmptyState
            icon={RefreshCw}
            title="Loading project data"
            description="Reading the current workspace from Neon."
          />
        </div>
      )}
      {!isLoading && !overview && (
        <div className="panel">
          <EmptyState
            icon={AlertTriangle}
            title="Project data unavailable"
            description="The workspace could not be loaded from the database. Try again when the API is available."
          />
        </div>
      )}
      {overview && (
        <>
          <SectionHeading
            eyebrow={`${overview.project.name} · Control Room`}
            title={`Welcome back, ${user?.name?.split(" ")[0] || "Team Member"}.`}
            description={overview.project.description || "Live coordination pulse of the project workspace."}
            action={
              <div className="heading-actions">
                <Button
                  variant="secondary"
                  onClick={handleSimulateChange}
                  disabled={simulating}
                  data-testid="button-simulate-event"
                >
                  <Zap size={14} className="amber-text" />
                  <span>
                    {simulating ? "Simulating…" : "Simulate Live Event"}
                  </span>
                </Button>
                <Button variant="primary" data-testid="button-share-briefing">
                  <Send size={14} /> Share Briefing
                </Button>
              </div>
            }
          />

          {isError && (
            <div
              className="inline-warning"
              data-testid="status-dashboard-error"
            >
              <AlertTriangle size={16} /> Live data is catching up. Showing the
              latest project context.
            </div>
          )}

          {/* Project Banner */}
          <div className="project-banner reveal reveal-delay-1">
            <div>
              <span className="eyebrow">Active project</span>
              <h2>{overview.project.name}</h2>
              <p>
                <Building2 size={14} /> {overview.project.location}{" "}
                <span>·</span> <span className="phase-dot" />{" "}
                {overview.project.phase}
              </p>
            </div>
            <div className="project-meta">
              <Pill tone={statusTone(overview.project.status)}>
                {overview.project.status}
              </Pill>
              <div className="project-progress">
                <strong>{overview.project.progress}%</strong>
                <span>overall progress</span>
                <div className="progress-track">
                  <i style={{ width: `${overview.project.progress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Trade Scope vs Entire Project Toggle */}
          <div className="role-scope-toggle-bar reveal reveal-delay-2">
            <div className="role-scope-tabs">
              <button
                type="button"
                className={`role-scope-btn ${viewScope === "trade" ? "active" : ""}`}
                onClick={() => setViewScope("trade")}
                data-testid="button-scope-trade"
              >
                <ShieldAlert size={14} />
                <span>My Trade Radar ({user?.role?.toUpperCase() || "TRADE"})</span>
                {overview.roleScope?.myApprovalsCount > 0 && (
                  <span className="count-pill danger" title="Sign-offs waiting specifically on you">
                    {overview.roleScope.myApprovalsCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                className={`role-scope-btn ${viewScope === "workspace" ? "active" : ""}`}
                onClick={() => setViewScope("workspace")}
                data-testid="button-scope-workspace"
              >
                <Building2 size={14} />
                <span>Entire Project Workspace</span>
              </button>
            </div>
            <span className="role-scope-hint">
              {viewScope === "trade"
                ? `Filtered strictly to ${user?.name}'s trade discipline & signing responsibilities.`
                : "Full multidisciplinary overview across all trades & packages."}
            </span>
          </div>

          {/* Health Metrics Grid */}
          <div className="health-grid reveal reveal-delay-2">
            {viewScope === "trade" ? (
              <>
                <HealthCard
                  label="My Work Packages"
                  value={overview.roleScope?.myActivitiesCount ?? 0}
                  note={`Active in ${user?.role || "your"} trade`}
                  icon={Briefcase}
                  tone="teal"
                  href="/activities"
                />
                <HealthCard
                  label="Sign-Offs Waiting On Me"
                  value={overview.roleScope?.myApprovalsCount ?? 0}
                  note={overview.roleScope?.myApprovalsCount ? "Action required from you" : "Queue clear"}
                  icon={FileCheck2}
                  tone={overview.roleScope?.myApprovalsCount ? "danger" : "slate"}
                  href="/approvals"
                />
                <HealthCard
                  label="Upstream Blockers Delaying Me"
                  value={overview.roleScope?.myBlockedUpstreamCount ?? 0}
                  note="Prerequisites holding up your trade"
                  icon={AlertTriangle}
                  tone={overview.roleScope?.myBlockedUpstreamCount ? "amber" : "slate"}
                  href="/activities"
                />
                <HealthCard
                  label="Changes In My Blast Radius"
                  value={overview.roleScope?.myChangesImpactCount ?? 0}
                  note="Directly touching your scope"
                  icon={Zap}
                  tone="slate"
                  href="/changes"
                />
              </>
            ) : (
              <>
                <HealthCard
                  label="Blocked work"
                  value={overview.stats.blocked}
                  note="Immediate handoff blockers"
                  icon={CircleDot}
                  tone="danger"
                  href="/activities"
                />
                <HealthCard
                  label="Overdue"
                  value={overview.stats.overdue}
                  note="Across all workstreams"
                  icon={Clock3}
                  tone="amber"
                  href="/activities"
                />
                <HealthCard
                  label="Awaiting approval"
                  value={overview.stats.approvals}
                  note="Critical decision queue"
                  icon={FileCheck2}
                  tone="slate"
                  href="/approvals"
                />
                <HealthCard
                  label="Open alerts"
                  value={overview.stats.alerts}
                  note="Since last briefing"
                  icon={Bell}
                  tone="teal"
                  href="/alerts"
                />
              </>
            )}
          </div>

          {/* Daily Briefing & Urgent Attention */}
          <div className="dashboard-grid">
            <section className="panel briefing-panel reveal reveal-delay-2">
              <PanelHeader
                eyebrow={viewScope === "trade" ? `${user?.role?.toUpperCase()} Radar Briefing` : "Daily Coordination Briefing"}
                title={viewScope === "trade" ? `${user?.name} · Trade Briefing` : (briefing?.greeting || "Project Briefing")}
                action={<span className="mono-label">{viewScope === "trade" ? "ROLE / TAILORED" : "AI / GROUNDED"}</span>}
              />
              <div className="briefing-summary">
                <Bot size={20} />
                <p>
                  {(viewScope === "trade" && overview.roleScope?.roleSummary)
                    ? overview.roleScope.roleSummary
                    : (briefing?.summary || "No briefing has been generated yet.")}
                </p>
              </div>
              <div className="briefing-items">
                {((viewScope === "trade" && overview.roleScope?.roleItems)
                  ? overview.roleScope.roleItems
                  : (briefing?.items || [])
                ).map((item: string, i: number) => (
                  <div key={item} data-testid={`text-briefing-item-${i}`}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <p>{item}</p>
                    <ArrowRight size={15} />
                  </div>
                ))}
              </div>
              <Link
                href="/ask"
                className="panel-link"
                data-testid="link-briefing-ask"
              >
                Ask Copilot a follow-up <ArrowRight size={14} />
              </Link>
            </section>

            <section className="panel reveal reveal-delay-3">
              <PanelHeader
                eyebrow="Attention required"
                title="Open signals"
                action={
                  <Link href="/alerts" className="panel-link">
                    View all <ArrowRight size={14} />
                  </Link>
                }
              />
              <div className="signal-list">
                {alerts.slice(0, 4).map((alert: any) => (
                  <SignalRow
                    key={alert.id}
                    tone={statusTone(alert.severity)}
                    title={alert.title}
                    meta={`${alert.severity} · ${alert.acknowledged ? "Acknowledged" : "Needs attention"}`}
                    href="/alerts"
                  />
                ))}
                {!alerts.length && (
                  <EmptyState
                    icon={Bell}
                    title="No open signals"
                    description="Alerts created from project activity will appear here."
                    compact
                  />
                )}
              </div>
              <div className="signal-footer">
                <span>Next multi-trade coordination standup</span>
                <b>Today, 4:00 PM</b>
              </div>
            </section>
          </div>

          {/* Latest Movement & Memory */}
          <section className="panel activity-panel reveal reveal-delay-4">
            <PanelHeader
              eyebrow="Latest movement"
              title="Project activity"
              action={
                <Link href="/memory" className="panel-link">
                  Open memory <ArrowRight size={14} />
                </Link>
              }
            />
            <div className="activity-feed">
              {activities.length ? (
                activities.slice(0, 5).map((event: any) => (
                  <div className="feed-row" key={event.id}>
                    <Avatar name={event.actor} color="teal" />
                    <div>
                      <b>{event.label}</b>
                      <p>{event.description}</p>
                    </div>
                    <time>{formatDate(event.createdAt || event.timestamp)}</time>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={ActivityIcon}
                  title="No recent movement recorded"
                  description="New updates will land here as the delivery team moves work forward."
                  compact
                />
              )}
            </div>
          </section>
        </>
      )}
    </Shell>
  );
}

function HealthCard({ label, value, note, icon: Icon, tone, href }: any) {
  return (
    <Link
      href={href}
      className="health-card pressable"
      data-testid={`link-health-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <div className={`health-icon health-${tone}`}>
        <Icon size={17} />
      </div>
      <div>
        <span>{label}</span>
        <b>{value}</b>
        <small>{note}</small>
      </div>
      <ArrowRight size={15} />
    </Link>
  );
}

function PanelHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function SignalRow({
  tone,
  title,
  meta,
  href,
}: {
  tone: string;
  title: string;
  meta: string;
  href?: string;
}) {
  const content = (
    <div className="signal-row pressable">
      <span className={`signal-mark ${tone}`} />
      <div>
        <b>{title}</b>
        <small>{meta}</small>
      </div>
      <ArrowRight size={15} />
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function EmptyState({ icon: Icon, title, description, compact = false }: any) {
  return (
    <div className={`empty-state ${compact ? "empty-compact" : ""}`}>
      <Icon size={22} />
      <b>{title}</b>
      <p>{description}</p>
    </div>
  );
}

function Stakeholders() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useListStakeholders();
  const { data: activitiesData } = useListActivities();
  const { data: approvalsData } = useListApprovals();
  const [viewMode, setViewMode] = useState<"directory" | "raci">("directory");
  const [search, setSearch] = useState("");
  const [selectedStakeholder, setSelectedStakeholder] = useState<any | null>(
    null,
  );
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newDiscipline, setNewDiscipline] = useState("Architecture");
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const people = (data ?? []).filter((p: any) =>
    `${p.name} ${p.company} ${p.role} ${p.discipline}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const handleAddStakeholder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newRole.trim()) return;
    setSubmitting(true);
    try {
      await createStakeholder({
        name: newName,
        role: newRole,
        discipline: newDiscipline,
        company: newCompany || "Specialist Consultant",
        phone: newPhone || "+1 (512) 555-0900",
        whatsapp: newPhone ? newPhone.replace(/[^0-9]/g, "") : "+15125550900",
      });
      qc.invalidateQueries();
      setShowAddModal(false);
      setNewName("");
      setNewRole("");
      setNewCompany("");
      setNewPhone("");
    } catch (err: any) {
      alert("Failed to add stakeholder: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <SectionHeading
        eyebrow="Project Network & Roles"
        title="Stakeholder Management"
        description="Multidisciplinary architects, engineers, contractors, and client representatives delivering project milestones."
        action={
          <div className="heading-actions">
            <div className="filter-pill-group">
              <button
                className={`filter-pill ${viewMode === "directory" ? "active" : ""}`}
                onClick={() => setViewMode("directory")}
              >
                Directory View
              </button>
              <button
                className={`filter-pill ${viewMode === "raci" ? "active" : ""}`}
                onClick={() => setViewMode("raci")}
              >
                RACI Responsibility Matrix
              </button>
            </div>
            <Button
              onClick={() => setShowAddModal(true)}
              data-testid="button-invite-stakeholder"
            >
              <Plus size={16} /> Add Stakeholder
            </Button>
          </div>
        }
      />

      {viewMode === "raci" ? (
        <RaciMatrix
          stakeholders={data ?? []}
          currentUserRole={user?.role}
          currentUserName={user?.name}
          onSelectStakeholder={(id) => {
            const sh = (data ?? []).find((p: any) => p.id === id);
            if (sh) setSelectedStakeholder(sh);
          }}
        />
      ) : (
        <>
          <div className="toolbar">
            <div className="search-field">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people, companies, roles, disciplines..."
                data-testid="input-search-stakeholders"
              />
            </div>
            <span className="toolbar-count">
              {people.length} people across 8 disciplines
            </span>
          </div>

          <div className="stakeholder-layout">
            <section className="panel stakeholder-panel">
              <PanelHeader
                eyebrow="Directory"
                title="Project team &amp; specialists"
                action={<span className="mono-label">LIVE NETWORK</span>}
              />
              {isLoading ? (
                <div className="stack-gap">
                  <Skeleton className="row-skeleton" />
                  <Skeleton className="row-skeleton" />
                  <Skeleton className="row-skeleton" />
                </div>
              ) : people.length ? (
                <div className="stakeholder-list">
                  {people.map((person: any, i: number) => (
                    <div
                      className="stakeholder-row pressable"
                      key={person.id}
                      onClick={() => setSelectedStakeholder(person)}
                      data-testid={`row-stakeholder-${person.id}`}
                    >
                      <Avatar
                        name={person.name}
                        color={["orange", "teal", "navy", "yellow"][i % 4]}
                      />
                      <div className="person-info">
                        <b>{person.name}</b>
                        <span>
                          {person.role} · <small>{person.discipline}</small>
                        </span>
                        <small>{person.company}</small>
                      </div>
                      <div className="person-stats">
                        <span>
                          <b>{person.ownedCount}</b> owned
                        </span>
                        <span>
                          <b>{person.affectedByCount ?? 0}</b> affected
                        </span>
                      </div>
                      <Pill tone={statusTone(person.status)}>
                        {person.status}
                      </Pill>
                      <button
                        className="row-more"
                        aria-label={`Open ${person.name}`}
                        data-testid={`button-open-stakeholder-${person.id}`}
                      >
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No stakeholders found"
                  description="Try a different search or add a new person to this project."
                />
              )}
            </section>

            <aside className="panel matrix-panel">
              <PanelHeader
                eyebrow="Discipline Coverage"
                title="Responsibility Hub"
              />
              <div className="coverage-graphic">
                <div className="coverage-center">
                  <Users size={18} />
                  <b>Grand Vista</b>
                  <small>{people.length} active leads</small>
                </div>
                <span className="coverage-node node-one">
                  Structure
                  <br />
                  <b>02</b>
                </span>
                <span className="coverage-node node-two">
                  MEP
                  <br />
                  <b>02</b>
                </span>
                <span className="coverage-node node-three">
                  Facade
                  <br />
                  <b>01</b>
                </span>
                <span className="coverage-node node-four">
                  Client
                  <br />
                  <b>02</b>
                </span>
              </div>
              <div className="matrix-legend">
                <span>
                  <i className="legend-dot legend-orange" />
                  Direct owner
                </span>
                <span>
                  <i className="legend-dot legend-teal" />
                  Affected trade
                </span>
                <span>
                  <i className="legend-dot legend-yellow" />
                  Reviewer
                </span>
              </div>
            </aside>
          </div>
        </>
      )}

      {/* Stakeholder Slide-Over Drawer */}
      <StakeholderDrawer
        stakeholder={selectedStakeholder}
        activities={activitiesData ?? []}
        approvals={approvalsData ?? []}
        onClose={() => setSelectedStakeholder(null)}
      />

      {/* Add Stakeholder Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Project Directory</span>
                <h2>Add Stakeholder</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddStakeholder}>
              <label>
                Full Name
                <input
                  required
                  placeholder="e.g. Liam Tanaka"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </label>
              <label>
                Role &amp; Title
                <input
                  required
                  placeholder="e.g. Acoustic &amp; Noise Consultant"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                />
              </label>
              <label>
                Discipline
                <select
                  value={newDiscipline}
                  onChange={(e) => setNewDiscipline(e.target.value)}
                >
                  <option>Architecture</option>
                  <option>Structural</option>
                  <option>MEP</option>
                  <option>Contractor</option>
                  <option>Facade</option>
                  <option>Client</option>
                  <option>Interiors</option>
                  <option>Safety</option>
                  <option>Civil</option>
                </select>
              </label>
              <label>
                Company / Firm
                <input
                  placeholder="e.g. Tanaka Acoustics Group"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
              </label>
              <label>
                Phone / WhatsApp Number
                <input
                  placeholder="e.g. +1 (512) 555-0812"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving…" : "Add to Network"}{" "}
                  <ArrowRight size={14} />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Activities() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useListActivities();
  const [filter, setFilter] = useState("All work");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Add activity form state
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Deliverable");
  const [discipline, setDiscipline] = useState("Structural");
  const [owner, setOwner] = useState(user?.name || "Neha Iyer");
  const [dueDate, setDueDate] = useState("Sep 28");
  const [location, setLocation] = useState("Level 1 Main Terrace");
  const [status, setStatus] = useState("in-progress");
  const [criticalPath, setCriticalPath] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit activity form state
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("Deliverable");
  const [editDiscipline, setEditDiscipline] = useState("Structural");
  const [editOwner, setEditOwner] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStatus, setEditStatus] = useState("in-progress");
  const [editCriticalPath, setEditCriticalPath] = useState(false);
  const [editBlockedReason, setEditBlockedReason] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activities = (data ?? []).filter((a: any) => {
    if (filter === "My Trade Scope") {
      const uRole = (user?.role || "").toLowerCase();
      const uName = (user?.name || "").toLowerCase();
      const uFirstName = uName ? uName.split(" ")[0] : "";
      const isOwnerMatch = uFirstName && a.owner?.toLowerCase().includes(uFirstName);
      const isDisciplineMatch =
        (uRole === "engineer" && (a.discipline === "Structural" || a.discipline === "Civil")) ||
        (uRole === "architect" && (a.discipline === "Architecture" || a.discipline === "Facade" || a.discipline === "Interiors")) ||
        (uRole === "contractor" && (a.discipline === "Civil" || a.discipline === "Construction" || a.discipline === "Facade")) ||
        (uRole === "mep" && (a.discipline === "MEP" || a.discipline === "Automation")) ||
        (uRole === "interior" && a.discipline === "Interiors") ||
        (uRole === "owner" && (a.discipline === "Client" || a.discipline === "Interiors" || a.discipline === "Architecture")) ||
        uRole === "admin";
      if (!isOwnerMatch && !isDisciplineMatch) return false;
    } else if (filter === "Blocked") {
      if (
        !a.status.toLowerCase().includes("block") &&
        !a.status.toLowerCase().includes("risk")
      )
        return false;
    } else if (filter !== "All work") {
      if (a.discipline !== filter && a.type !== filter) return false;
    }
    if (
      search &&
      !`${a.title} ${a.owner} ${a.discipline} ${a.location || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const openEditModal = (item: any) => {
    setSelectedActivity(item);
    setEditTitle(item.title || "");
    setEditType(item.type || "Deliverable");
    setEditDiscipline(item.discipline || "Structural");
    setEditOwner(item.owner || "");
    setEditDueDate(item.dueDate || "");
    setEditLocation(item.location || "");
    setEditStatus(item.status || "in-progress");
    setEditCriticalPath(Boolean(item.criticalPath));
    setEditBlockedReason(item.blockedReason || "");
  };

  const handleToggleStatus = async (item: any) => {
    const nextStatus =
      item.status === "complete"
        ? "in-progress"
        : item.status === "blocked"
          ? "in-progress"
          : "complete";
    try {
      await updateActivity(item.id, {
        status: nextStatus,
        blockedReason: nextStatus === "complete" ? null : item.blockedReason,
      });
      qc.invalidateQueries();
    } catch (e: any) {
      alert("Error updating activity: " + e.message);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !owner.trim()) return;
    setSubmitting(true);
    try {
      await createActivity({
        title: title.trim(),
        type,
        discipline,
        owner: owner.trim(),
        dueDate: dueDate.trim() || "TBD",
        location: location.trim(),
        status,
        criticalPath,
        blockedReason:
          status === "blocked" || status === "at-risk"
            ? blockedReason.trim() || "Awaiting prerequisites"
            : null,
      });
      qc.invalidateQueries();
      setShowAddModal(false);
      setTitle("");
      setBlockedReason("");
    } catch (e: any) {
      alert("Error adding activity: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedActivity || !editTitle.trim() || !editOwner.trim()) return;
    setEditSubmitting(true);
    try {
      await updateActivity(selectedActivity.id, {
        title: editTitle.trim(),
        type: editType,
        discipline: editDiscipline,
        owner: editOwner.trim(),
        dueDate: editDueDate.trim() || "TBD",
        location: editLocation.trim(),
        status: editStatus,
        criticalPath: editCriticalPath,
        blockedReason:
          editStatus === "blocked" || editStatus === "at-risk"
            ? editBlockedReason.trim() || "Awaiting prerequisites"
            : null,
      });
      qc.invalidateQueries();
      setSelectedActivity(null);
    } catch (err: any) {
      alert("Error updating activity: " + err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteActivity = async () => {
    if (!selectedActivity) return;
    if (!confirm(`Are you sure you want to delete activity "${selectedActivity.title}"?`)) return;
    setDeleting(true);
    try {
      await deleteActivity(selectedActivity.id);
      qc.invalidateQueries();
      setSelectedActivity(null);
    } catch (err: any) {
      alert("Error deleting activity: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Shell>
      <SectionHeading
        eyebrow="Work Register &amp; Deliverables"
        title="Project Activities"
        description="Tasks, packages, and deliverables with clear owners, milestone dates, and active dependency links."
        action={
          <Button
            onClick={() => setShowAddModal(true)}
            data-testid="button-add-activity"
          >
            <Plus size={16} /> Add Activity
          </Button>
        }
      />

      <div className="toolbar">
        <div className="search-field">
          <Search size={16} />
          <input
            placeholder="Search activities, packages, owners..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {[
            "All work",
            "My Trade Scope",
            "Blocked",
            "Structural",
            "MEP",
            "Facade",
            "Interiors",
            "Safety",
          ].map((item) => (
            <button
              key={item}
              className={filter === item ? "filter-tab-active" : ""}
              onClick={() => setFilter(item)}
              data-testid={`button-filter-activity-${item.toLowerCase()}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <section className="panel table-panel">
        {isLoading ? (
          <div className="stack-gap">
            <Skeleton className="table-skeleton" />
            <Skeleton className="table-skeleton" />
            <Skeleton className="table-skeleton" />
          </div>
        ) : activities.length ? (
          <div className="data-table">
            <div className="table-head">
              <span>Activity / Deliverable</span>
              <span>Owner &amp; Trade</span>
              <span>Status</span>
              <span>Due</span>
              <span>Links</span>
              <span />
            </div>
            {activities.map((item: any) => (
              <div
                className="table-row activity-clickable"
                key={item.id}
                data-testid={`row-activity-${item.id}`}
                onClick={() => openEditModal(item)}
                title="Click to view &amp; edit activity details"
              >
                <div className="activity-title">
                  <span
                    className={`type-bar type-${statusTone(item.status)}`}
                  />
                  <div>
                    <b>{item.title}</b>
                    <small>
                      {item.type} · {item.discipline}{" "}
                      {item.location && `· ${item.location}`}
                    </small>
                    {item.blockedReason && (
                      <span className="blocked-note">
                        <AlertTriangle size={12} /> {item.blockedReason}
                      </span>
                    )}
                  </div>
                </div>

                <div className="owner-cell">
                  <Avatar name={item.owner} color="teal" />
                  <span>{item.owner}</span>
                </div>

                <div
                  className="pressable"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStatus(item);
                  }}
                  title="Click to cycle status"
                >
                  <Pill tone={statusTone(item.status)}>{item.status}</Pill>
                </div>

                <span className="date-cell">{formatDate(item.dueDate)}</span>
                <span className="dependency-cell">
                  <Link2 size={14} /> {item.dependencyCount ?? 0}
                </span>

                <button
                  className="row-more"
                  aria-label={`Toggle ${item.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleStatus(item);
                  }}
                  title="Quick toggle status"
                >
                  <CheckCircle2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ListChecks}
            title="No activities match this view"
            description="Change the filter or create a new deliverable."
          />
        )}
      </section>

      {/* Edit Activity Modal */}
      {selectedActivity && (
        <div className="modal-backdrop" onClick={() => setSelectedActivity(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  {selectedActivity.discipline || "Deliverable"} · Details &amp; Management
                </span>
                <h2>Edit Activity</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setSelectedActivity(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUpdateActivity}>
              <label>
                Title / Task Name
                <input
                  required
                  placeholder="e.g. Level 14 transfer beam laser inspection"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </label>

              <div className="modal-form-grid">
                <label>
                  Discipline
                  <select
                    value={editDiscipline}
                    onChange={(e) => setEditDiscipline(e.target.value)}
                  >
                    <option>Structural</option>
                    <option>MEP</option>
                    <option>Facade</option>
                    <option>Interiors</option>
                    <option>Safety</option>
                    <option>Civil</option>
                    <option>Architecture</option>
                    <option>General</option>
                  </select>
                </label>
                <label>
                  Type
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                  >
                    <option>Deliverable</option>
                    <option>Approval</option>
                    <option>Milestone</option>
                    <option>Inspection</option>
                    <option>Procurement</option>
                    <option>Change</option>
                  </select>
                </label>
              </div>

              <div className="modal-form-grid">
                <label>
                  Responsible Owner
                  <input
                    required
                    placeholder="e.g. Neha Iyer"
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                  />
                </label>
                <label>
                  Location / Zone
                  <input
                    placeholder="e.g. Tower B - L14"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-form-grid">
                <label>
                  Current Status
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                  >
                    <option value="in-progress">In Progress</option>
                    <option value="complete">Complete</option>
                    <option value="blocked">Blocked</option>
                    <option value="at-risk">At Risk</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>
                <label>
                  Due Date
                  <input
                    placeholder="e.g. Sep 28"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                </label>
              </div>

              <label className="modal-checkbox-row">
                <input
                  type="checkbox"
                  checked={editCriticalPath}
                  onChange={(e) => setEditCriticalPath(e.target.checked)}
                />
                <span>Critical Path Activity (Directly governs project milestone timeline)</span>
              </label>

              {(editStatus === "blocked" || editStatus === "at-risk") && (
                <label>
                  Blocked Reason / Risk Mitigation
                  <input
                    placeholder="e.g. Awaiting structural lintel deflection engineering approval"
                    value={editBlockedReason}
                    onChange={(e) => setEditBlockedReason(e.target.value)}
                  />
                </label>
              )}

              <div className="modal-actions" style={{ justifyContent: "space-between" }}>
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDeleteActivity}
                  disabled={deleting || editSubmitting}
                >
                  <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
                </Button>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setSelectedActivity(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={editSubmitting}>
                    {editSubmitting ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Activity Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Work Register</span>
                <h2>Add Deliverable or Activity</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddActivity}>
              <label>
                Title / Task Name
                <input
                  required
                  placeholder="e.g. Level 14 transfer beam laser inspection"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <div className="modal-form-grid">
                <label>
                  Discipline
                  <select
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value)}
                  >
                    <option>Structural</option>
                    <option>MEP</option>
                    <option>Facade</option>
                    <option>Interiors</option>
                    <option>Safety</option>
                    <option>Civil</option>
                    <option>Architecture</option>
                    <option>General</option>
                  </select>
                </label>
                <label>
                  Type
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    <option>Deliverable</option>
                    <option>Approval</option>
                    <option>Milestone</option>
                    <option>Inspection</option>
                    <option>Procurement</option>
                    <option>Change</option>
                  </select>
                </label>
              </div>

              <div className="modal-form-grid">
                <label>
                  Responsible Owner
                  <input
                    required
                    placeholder="e.g. Neha Iyer"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                  />
                </label>
                <label>
                  Location / Zone
                  <input
                    placeholder="e.g. Tower B - L14"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </label>
              </div>

              <div className="modal-form-grid">
                <label>
                  Initial Status
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="in-progress">In Progress</option>
                    <option value="pending">Pending</option>
                    <option value="blocked">Blocked</option>
                    <option value="at-risk">At Risk</option>
                    <option value="complete">Complete</option>
                  </select>
                </label>
                <label>
                  Due Date
                  <input
                    placeholder="e.g. Sep 28"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </label>
              </div>

              <label className="modal-checkbox-row">
                <input
                  type="checkbox"
                  checked={criticalPath}
                  onChange={(e) => setCriticalPath(e.target.checked)}
                />
                <span>Critical Path Activity (Directly governs project milestone timeline)</span>
              </label>

              {(status === "blocked" || status === "at-risk") && (
                <label>
                  Blocked Reason / Risk Note
                  <input
                    placeholder="e.g. Awaiting structural lintel deflection engineering approval"
                    value={blockedReason}
                    onChange={(e) => setBlockedReason(e.target.value)}
                  />
                </label>
              )}

              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating…" : "Save Activity"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Dependencies() {
  const qc = useQueryClient();
  const { data: activitiesData } = useListActivities();
  const { data: dependenciesData, isLoading } = useListDependencies();
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [depType, setDepType] = useState("blocks");
  const [submitting, setSubmitting] = useState(false);

  const activities = activitiesData ?? [];
  const dependencies = dependenciesData ?? [];

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId || fromId === toId) {
      alert("Select two different activities to connect");
      return;
    }
    setSubmitting(true);
    try {
      await createDependency({ fromId, toId, type: depType });
      qc.invalidateQueries();
      setShowLinkModal(false);
    } catch (e: any) {
      alert("Error linking work: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <SectionHeading
        eyebrow="Connected Workstreams"
        title="Interactive Dependency Graph"
        description="See what is waiting on what across disciplines — eliminate handoff delays before they cascade into the critical path."
        action={
          <div className="heading-actions">
            <Button
              onClick={() => setShowLinkModal(true)}
              data-testid="button-add-dependency"
            >
              <Plus size={16} /> Link Dependencies
            </Button>
          </div>
        }
      />

      <div className="dependency-summary">
        <div>
          <span className="eyebrow">Active Chains</span>
          <b>{dependencies.length}</b>
          <small>Across the current phase</small>
        </div>
        <div>
          <span className="eyebrow">At Risk / Blocking</span>
          <b className="danger-text">
            {dependencies.filter(
              (d: any) => d.type === "blocks" || d.status === "at-risk",
            ).length}
          </b>
          <small>Need multi-trade alignment</small>
        </div>
        <div>
          <span className="eyebrow">Critical Flow Chains</span>
          <b className="teal-text">
            {activities.filter((a: any) => a.criticalPath).length}
          </b>
          <small>Driving project milestones</small>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="graph-skeleton" />
      ) : (
        <DependencyGraph
          activities={activities}
          dependencies={dependencies}
          onAddDependency={() => setShowLinkModal(true)}
        />
      )}

      {/* Link Work Modal */}
      {showLinkModal && (
        <div className="modal-backdrop" onClick={() => setShowLinkModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Dependency Graph</span>
                <h2>Connect Project Work</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowLinkModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateLink}>
              <label>
                Prerequisite Activity (Source)
                <select
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                  required
                >
                  <option value="">Select source activity...</option>
                  {activities.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.owner})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Relationship Type
                <select
                  value={depType}
                  onChange={(e) => setDepType(e.target.value)}
                >
                  <option value="blocks">
                    Blocks (Must finish before target begins)
                  </option>
                  <option value="precedes">
                    Precedes (Follows in workflow sequence)
                  </option>
                  <option value="requires">
                    Requires (Needs technical input from source)
                  </option>
                  <option value="informs">
                    Informs (Provides data for verification)
                  </option>
                </select>
              </label>

              <label>
                Dependent Activity (Target)
                <select
                  value={toId}
                  onChange={(e) => setToId(e.target.value)}
                  required
                >
                  <option value="">Select target activity...</option>
                  {activities.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.owner})
                    </option>
                  ))}
                </select>
              </label>

              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowLinkModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Connecting…" : "Establish Link"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Changes() {
  const { data } = useListChanges();
  const create = useCreateChange();
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState("medium");
  const changes = data ?? [];

  const submit = () => {
    if (!title.trim() || !summary.trim()) return;
    create.mutate(
      { data: { title, summary, severity } },
      {
        onSuccess: () => {
          setCompose(false);
          setTitle("");
          setSummary("");
        },
      },
    );
  };

  return (
    <Shell>
      <SectionHeading
        eyebrow="Change Intelligence &amp; Blast Radius"
        title="Project Change Log"
        description="A clear record of what shifted, who logged it, and what it touches across the entire building lifecycle."
        action={
          <div className="heading-actions">
            <Button
              onClick={() => setCompose(true)}
              data-testid="button-log-change"
            >
              <Plus size={16} /> Log a Change
            </Button>
          </div>
        }
      />

      <div className="change-overview">
        <div className="change-kicker">
          <span className="signal-mark amber" />
          <span>
            <b>{changes.length}</b> changes active
          </span>
        </div>
        <div className="change-kicker">
          <span className="signal-mark danger" />
          <span>
            <b>
              {changes.filter((c: any) => statusTone(c.severity) === "danger")
                .length}
            </b>{" "}
            high severity
          </span>
        </div>
        <div className="change-kicker">
          <span className="signal-mark teal" />
          <span>
            <b>100%</b> blast-radius analyzed
          </span>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="change-list">
          {changes.length ? (
            changes.map((change: any) => (
              <Link
                href={`/changes/${change.id}`}
                className="change-row pressable"
                key={change.id}
                data-testid={`link-change-${change.id}`}
              >
                <div className={`change-index ${statusTone(change.severity)}`}>
                  ↗
                </div>
                <div className="change-main">
                  <div>
                    <b>{change.title}</b>
                    <Pill tone={statusTone(change.severity)}>
                      {change.severity}
                    </Pill>
                  </div>
                  <p>{change.summary}</p>
                  <small>
                    Logged by {change.createdBy} ·{" "}
                    {formatDate(change.createdAt)}
                  </small>
                </div>
                <div className="change-impact">
                  <b>{change.affectedCount}</b>
                  <span>affected records</span>
                </div>
                <div className="change-status">
                  <Pill tone={statusTone(change.status)}>{change.status}</Pill>
                  <ArrowRight size={16} />
                </div>
              </Link>
            ))
          ) : (
            <EmptyState
              icon={Zap}
              title="No changes recorded yet"
              description="Log a shift or ingest a message from field teams."
            />
          )}
        </div>
      </section>

      {/* Manual Change Modal */}
      {compose && (
        <div className="modal-backdrop" onClick={() => setCompose(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">New Change Event</span>
                <h2>Log a Project Change</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setCompose(false)}
                aria-label="Close"
                data-testid="button-close-change"
              >
                <X size={18} />
              </button>
            </div>
            <label>
              Change Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What shifted? (e.g. Slab datum elevation, material switch)"
                data-testid="input-change-title"
              />
            </label>
            <label>
              Summary &amp; Context
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Provide enough detail for downstream trades to act..."
                rows={4}
                data-testid="input-change-summary"
              />
            </label>
            <label>
              Severity Rating
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                data-testid="select-change-severity"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <div className="modal-actions">
              <Button
                variant="secondary"
                onClick={() => setCompose(false)}
                data-testid="button-cancel-change"
              >
                Cancel
              </Button>
              <Button
                onClick={submit}
                disabled={create.isPending}
                data-testid="button-submit-change"
              >
                {create.isPending ? "Saving…" : "Save & Analyze Blast Radius"}{" "}
                <ArrowRight size={15} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function ChangeImpact() {
  const { id = "" } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: report, isLoading } = useGetChangeImpact(id, {
    query: { enabled: !!id, queryKey: getGetChangeImpactQueryKey(id) },
  });
  const analyze = useAnalyzeChangeImpact();
  const [adopting, setAdopting] = useState(false);
  const [adoptedMsg, setAdoptedMsg] = useState("");
  const [dispatchedMsg, setDispatchedMsg] = useState("");
  const [analysisError, setAnalysisError] = useState("");

  const impact = (analyze.data as any) ?? report;

  const handleRerunAnalysis = () => {
    setAnalysisError("");
    analyze.mutate(
      { changeId: id },
      {
        onSuccess: (data) => {
          qc.setQueryData(getGetChangeImpactQueryKey(id), data);
          qc.invalidateQueries({ queryKey: getGetChangeImpactQueryKey(id) });
        },
        onError: (err: any) => {
          setAnalysisError(err?.message || "Failed to analyze change impact. Please try again.");
        },
      },
    );
  };

  const handleAdoptActions = async () => {
    setAdopting(true);
    try {
      const res = await adoptChangeActions(id);
      qc.invalidateQueries();
      setAdoptedMsg(
        `Success: ${res.adopted} draft actions converted into live tasks and assigned to owners!`,
      );
    } catch (e: any) {
      alert("Error adopting actions: " + e.message);
    } finally {
      setAdopting(false);
    }
  };

  const handleDispatchNotifications = () => {
    setDispatchedMsg(
      "Notifications dispatched via WhatsApp & Email to: " +
        ((impact as any)?.affectedStakeholders?.join(", ") ||
          "All affected leads"),
    );
  };

  return (
    <Shell>
      <Link
        href="/changes"
        className="back-link"
        data-testid="link-back-changes"
      >
        <ArrowLeft size={15} /> Back to Change Log
      </Link>

      <SectionHeading
        eyebrow="Blast Radius &amp; Impact Report"
        title={
          impact?.headline ||
          (isLoading ? "Analyzing change…" : "Change Impact Report")
        }
        description={
          impact?.explanation ||
          "Trace affected trades, milestones, and decisions before the ripple causes expensive rework."
        }
        action={
          <div className="heading-actions">
            <Button
              onClick={handleRerunAnalysis}
              disabled={analyze.isPending}
              variant="secondary"
              data-testid="button-analyze-impact"
            >
              <Sparkles size={15} />{" "}
              {analyze.isPending ? "Analyzing…" : "Re-run AI Analysis"}
            </Button>
            <Button
              onClick={handleAdoptActions}
              disabled={adopting || !!adoptedMsg}
              variant="primary"
            >
              <CheckCircle2 size={15} />{" "}
              {adoptedMsg ? "Actions Adopted" : "Adopt Draft Actions"}
            </Button>
          </div>
        }
      />

      {adoptedMsg && (
        <div
          className="inline-warning"
          style={{
            background: "#dcfce7",
            borderColor: "#86efac",
            color: "#166534",
          }}
        >
          <CheckCircle2 size={16} /> {adoptedMsg}
        </div>
      )}

      {dispatchedMsg && (
        <div
          className="inline-warning"
          style={{
            background: "#e0f2fe",
            borderColor: "#7dd3fc",
            color: "#0369a1",
          }}
        >
          <Send size={16} /> {dispatchedMsg}
        </div>
      )}

      {impact ? (
        <>
          <div className="impact-banner">
            <div>
              <span className="eyebrow">Estimated Schedule Slip</span>
              <b>{impact.scheduleImpact}</b>
            </div>
            <Pill tone={statusTone(impact.severity)}>
              {impact.severity} Severity
            </Pill>
            <div className="impact-divider" />
            <div>
              <span className="eyebrow">Affected Deliverables</span>
              <b>{impact.items?.length ?? 0} records</b>
            </div>
            <div className="impact-divider" />
            <Button variant="secondary" onClick={handleDispatchNotifications}>
              <MessageSquare size={14} className="teal-text" /> Broadcast
              WhatsApp Alert
            </Button>
          </div>

          <div className="impact-layout">
            <section className="panel">
              <PanelHeader
                eyebrow="Downstream Ripple"
                title="Affected Workstreams &amp; Tasks"
              />
              <div className="impact-items">
                {impact.items?.map((item: any) => (
                  <div
                    className="impact-item"
                    key={item.id}
                    data-testid={`row-impact-${item.id}`}
                  >
                    <div className={`impact-kind ${statusTone(item.severity)}`}>
                      <CircleDot size={15} />
                    </div>
                    <div>
                      <b>{item.label}</b>
                      <p>{item.reason}</p>
                      <small>
                        {item.kind} · Owner: <strong>{item.owner}</strong>{" "}
                        {item.discipline && `(${item.discipline})`}
                      </small>
                    </div>
                    <span className="date-cell">
                      {formatDate(item.dueDate)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <aside className="panel">
              <PanelHeader
                eyebrow="Suggested Follow-Through"
                title="AI Draft Mitigation Actions"
              />
              <div className="draft-actions">
                {impact.draftActions?.map((action: any) => (
                  <div className="draft-action" key={action.id}>
                    <span className="check-box">
                      <Check size={13} />
                    </span>
                    <div>
                      <b>{action.title}</b>
                      <small>
                        Assigned to: <strong>{action.owner}</strong> · Due{" "}
                        {formatDate(action.dueDate)}
                      </small>
                    </div>
                    <Pill tone={statusTone(action.priority)}>
                      {action.priority}
                    </Pill>
                  </div>
                ))}
              </div>

              <div className="approval-callout">
                <FileCheck2 size={16} />
                <div>
                  <b>{impact.approvals?.length || 2} Sign-Offs Required</b>
                  <p>
                    Hold multi-trade sign-off before releasing the next
                    structural slab pour.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </>
      ) : (
        <div className="panel">
          <EmptyState
            icon={Sparkles}
            title={
              isLoading
                ? "Computing project blast radius…"
                : "Impact report unavailable"
            }
            description={
              isLoading
                ? "Traversing dependency graph."
                : "Try running the analysis again."
            }
          />
        </div>
      )}
    </Shell>
  );
}

function Approvals() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data } = useListApprovals();
  const [tab, setTab] = useState("Needs decision");
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Form state
  const [reqTitle, setReqTitle] = useState("");
  const [reqApprover, setReqApprover] = useState("Rajesh Patel");
  const [reqCategory, setReqCategory] = useState("Structural");
  const [reqDue, setReqDue] = useState("Today");
  const [reqSummary, setReqSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const approvals = (data ?? []).filter((a: any) =>
    tab === "Needs decision"
      ? !["approved", "rejected"].includes(a.status.toLowerCase())
      : ["approved", "rejected"].includes(a.status.toLowerCase()),
  );

  const decide = async (id: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE}/approvals/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("coord_token") || ""}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await safeParseResponse<any>(res);
      if (!res.ok) {
        alert(
          `RBAC Authorization Notice (${res.status}):\n${data?.error || data?.message || "Failed to update approval. Check your active role permissions."}`,
        );
        return;
      }
      qc.invalidateQueries();
    } catch (err: any) {
      alert("Error processing approval: " + err.message);
    }
  };

  const handleRequestApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim() || !reqApprover.trim()) return;
    setSubmitting(true);
    try {
      await createApproval({
        title: reqTitle,
        approver: reqApprover,
        category: reqCategory,
        dueDate: reqDue,
        impactSummary: reqSummary || "Required for package freeze",
      });
      qc.invalidateQueries();
      setShowRequestModal(false);
      setReqTitle("");
    } catch (e: any) {
      alert("Failed to request approval: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <SectionHeading
        eyebrow="Decision Queue &amp; Governance"
        title="Approval Management"
        description="Resolve critical technical submittals and sign-offs that unblock downstream activities."
        action={
          <Button onClick={() => setShowRequestModal(true)}>
            <Plus size={16} /> Request Approval
          </Button>
        }
      />

      <div className="subnav-tabs">
        {["Needs decision", "Decision history"].map((item) => (
          <button
            key={item}
            className={tab === item ? "subnav-active" : ""}
            onClick={() => setTab(item)}
            data-testid={`button-approval-tab-${item.toLowerCase().replace(/\s/g, "-")}`}
          >
            {item}
            <span>
              {item === "Needs decision"
                ? approvals.length
                : (data ?? []).length - approvals.length}
            </span>
          </button>
        ))}
      </div>

      <section className="panel approval-panel">
        <div className="approval-list">
          {approvals.length ? (
            approvals.map((approval: any) => (
              <div
                className="approval-row"
                key={approval.id}
                data-testid={`row-approval-${approval.id}`}
              >
                <div className="approval-category">
                  {approval.category?.slice(0, 2).toUpperCase()}
                </div>
                <div className="approval-main">
                  <div className="approval-title-row">
                    <b>{approval.title}</b>
                    {approval.canSign ? (
                      <span
                        className="auth-badge auth-badge-authorized"
                        title="You have designated signing authority for this technical submittal"
                        data-testid={`badge-auth-authorized-${approval.id}`}
                      >
                        <CheckCircle2 size={12} />
                        <span>Signing Authority: You ({user?.role?.toUpperCase() || "AUTHORIZED"})</span>
                      </span>
                    ) : (
                      <span
                        className="auth-badge auth-badge-restricted"
                        title={approval.authReason || `Requires ${approval.requiredRole || approval.approver} sign-off`}
                        data-testid={`badge-auth-restricted-${approval.id}`}
                      >
                        <ShieldAlert size={12} />
                        <span>Requires {approval.requiredRole || approval.approver} Sign-Off · Read-Only for {user?.role?.toUpperCase() || "YOU"}</span>
                      </span>
                    )}
                  </div>
                  <p>
                    Requested by <strong>{approval.requester}</strong> ·
                    Designated Approver: <strong>{approval.approver}</strong>
                  </p>
                  {approval.impactSummary && (
                    <small className="text-muted">
                      {approval.impactSummary}
                    </small>
                  )}
                  <small>Due {formatDate(approval.dueDate)}</small>
                </div>
                <Pill tone={statusTone(approval.status)}>
                  {approval.status}
                </Pill>
                {tab === "Needs decision" && (
                  <div className="approval-actions">
                    {approval.canSign ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => decide(approval.id, "Rejected")}
                          data-testid={`button-reject-approval-${approval.id}`}
                        >
                          Decline
                        </Button>
                        <Button
                          onClick={() => decide(approval.id, "Approved")}
                          data-testid={`button-approve-approval-${approval.id}`}
                        >
                          <Check size={14} /> Approve &amp; Unblock
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          disabled
                          title={approval.authReason || `Requires ${approval.requiredRole || approval.approver} sign-off`}
                          data-testid={`button-reject-disabled-${approval.id}`}
                        >
                          Decline
                        </Button>
                        <Button
                          disabled
                          title={approval.authReason || `Requires ${approval.requiredRole || approval.approver} sign-off`}
                          data-testid={`button-approve-disabled-${approval.id}`}
                        >
                          <Lock size={13} /> Sign-Off Restricted
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <EmptyState
              icon={FileCheck2}
              title={
                tab === "Needs decision"
                  ? "Decision queue is clear"
                  : "No decision history yet"
              }
              description={
                tab === "Needs decision"
                  ? "All technical submittals have been resolved."
                  : "Signed-off submittals will be archived here."
              }
            />
          )}
        </div>
      </section>

      {/* Request Approval Modal */}
      {showRequestModal && (
        <div
          className="modal-backdrop"
          onClick={() => setShowRequestModal(false)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Sign-Off Submittal</span>
                <h2>Request Project Approval</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowRequestModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRequestApproval}>
              <label>
                Approval Title
                <input
                  required
                  placeholder="e.g. Cantilever living room post-tensioning stress certification"
                  value={reqTitle}
                  onChange={(e) => setReqTitle(e.target.value)}
                />
              </label>
              <label>
                Designated Decision Maker (Approver)
                <select
                  value={reqApprover}
                  onChange={(e) => setReqApprover(e.target.value)}
                >
                  <option value="Rajesh Patel">Rajesh Patel (Principal Structural Engineer)</option>
                  <option value="Elena Rostova">Elena Rostova (Principal Architect)</option>
                  <option value="Marcus Vance">Marcus Vance (Client / Owner)</option>
                  <option value="David Chen">David Chen (Project Director / PM)</option>
                  <option value="Tariq Mansoor">Tariq Mansoor (MEP & Smart Systems)</option>
                </select>
              </label>
              <label>
                Category
                <select
                  value={reqCategory}
                  onChange={(e) => setReqCategory(e.target.value)}
                >
                  <option>Structural</option>
                  <option>Facade</option>
                  <option>MEP</option>
                  <option>Life Safety</option>
                  <option>Finishes</option>
                </select>
              </label>
              <label>
                Due Date
                <input
                  value={reqDue}
                  onChange={(e) => setReqDue(e.target.value)}
                />
              </label>
              <label>
                Impact on downstream trades
                <textarea
                  rows={3}
                  value={reqSummary}
                  onChange={(e) => setReqSummary(e.target.value)}
                  placeholder="What gets unblocked when this is signed off?"
                />
              </label>
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowRequestModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit for Decision"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Actions() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data } = useListActions();
  const update = useUpdateAction();
  const [tab, setTab] = useState("Open");
  const [filterMine, setFilterMine] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState("Elena Rostova");
  const [priority, setPriority] = useState("high");
  const [dueDate, setDueDate] = useState("Sep 20");
  const [submitting, setSubmitting] = useState(false);

  const actions = (data ?? []).filter((a: any) => {
    const isDone =
      a.status.toLowerCase().includes("done") ||
      a.status.toLowerCase().includes("complete");
    const matchesTab = tab === "Open" ? !isDone : isDone;
    if (!matchesTab) return false;
    if (filterMine && user?.name) {
      const first = user.name.split(" ")[0].toLowerCase();
      return a.owner?.toLowerCase().includes(first);
    }
    return true;
  });

  const handleToggleAction = (action: any) => {
    const nextStatus = action.status.toLowerCase().includes("done")
      ? "todo"
      : "done";
    update.mutate(
      { actionId: action.id, data: { status: nextStatus } },
      { onSuccess: () => qc.invalidateQueries() },
    );
  };

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createAction({ title, owner, priority, dueDate });
      qc.invalidateQueries();
      setShowAddModal(false);
      setTitle("");
    } catch (e: any) {
      alert("Failed to add action: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <SectionHeading
        eyebrow="Accountability Queue"
        title="Action Tracking"
        description="Clear, assigned next moves across project workstreams to prevent handoffs from falling into the black hole."
        action={
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Create Action
          </Button>
        }
      />

      <div className="action-summary">
        <div>
          <span className="eyebrow">Active Action Items</span>
          <b>{actions.length}</b>
          <small>Keep your handoffs moving</small>
        </div>
        <div>
          <span className="eyebrow">High / Urgent</span>
          <b className="amber-text">
            {actions.filter((a: any) => ["high", "urgent"].includes(a.priority?.toLowerCase())).length}
          </b>
          <small>Require closure this week</small>
        </div>
        <div>
          <span className="eyebrow">Resolved This Phase</span>
          <b className="teal-text">
            {(data ?? []).filter((a: any) => a.status?.toLowerCase().includes("done")).length}
          </b>
          <small>Recorded in project memory</small>
        </div>
      </div>

      <div className="subnav-tabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={tab === "Open" ? "subnav-active" : ""}
            onClick={() => setTab("Open")}
            data-testid="button-actions-open"
          >
            Open
          </button>
          <button
            className={tab === "Completed" ? "subnav-active" : ""}
            onClick={() => setTab("Completed")}
            data-testid="button-actions-completed"
          >
            Completed
          </button>
        </div>
        <div className="filter-pill-group">
          <button
            className={`filter-pill ${!filterMine ? "active" : ""}`}
            onClick={() => setFilterMine(false)}
          >
            All Actions
          </button>
          <button
            className={`filter-pill ${filterMine ? "active" : ""}`}
            onClick={() => setFilterMine(true)}
            data-testid="button-actions-mine"
          >
            Assigned to Me ({user?.name?.split(" ")[0] || "My"})
          </button>
        </div>
      </div>

      <section className="panel actions-panel">
        <div className="action-list">
          {actions.length ? (
            actions.map((action: any) => (
              <div
                className="action-row"
                key={action.id}
                data-testid={`row-action-${action.id}`}
              >
                <button
                  className={`action-check ${action.status.toLowerCase().includes("done") ? "checked" : ""}`}
                  onClick={() => handleToggleAction(action)}
                  aria-label={`Mark ${action.title}`}
                  data-testid={`button-toggle-action-${action.id}`}
                >
                  <Check size={14} />
                </button>
                <div className="action-main">
                  <div>
                    <b>{action.title}</b>
                    <Pill tone={statusTone(action.priority)}>
                      {action.priority}
                    </Pill>
                  </div>
                  <p>Triggered by: {action.source}</p>
                </div>
                <div className="action-owner">
                  <Avatar name={action.owner} color="teal" />
                  <span>{action.owner}</span>
                </div>
                <div className="action-due">
                  <small>DUE</small>
                  <b>{formatDate(action.dueDate)}</b>
                </div>
                <ArrowRight size={16} />
              </div>
            ))
          ) : (
            <EmptyState
              icon={Target}
              title="No actions in this queue"
              description="Your assigned tasks will populate as the project progresses."
            />
          )}
        </div>
      </section>

      {/* Add Action Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Action Item</span>
                <h2>Assign Next Action</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddAction}>
              <label>
                Action Description
                <input
                  required
                  placeholder="e.g. Verify hydronic sleeve clearance through cantilever rebar cage"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Assignee (Owner)
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                >
                  <option value="David Chen">David Chen (Project Director / PM)</option>
                  <option value="Elena Rostova">Elena Rostova (Lead Architect)</option>
                  <option value="Rajesh Patel">Rajesh Patel (Principal Structural Engineer)</option>
                  <option value="Carlos Gomez">Carlos Gomez (General Contractor)</option>
                  <option value="Sophia Laurent">Sophia Laurent (Lead Interior Designer)</option>
                  <option value="Tariq Mansoor">Tariq Mansoor (MEP & Smart Systems)</option>
                  <option value="Liam O'Connor">Liam O'Connor (Landscape Architect)</option>
                  <option value="Marcus Vance">Marcus Vance (Client / Owner)</option>
                </select>
              </label>
              <label>
                Priority
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="urgent">Urgent (Critical Path)</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </label>
              <label>
                Due Date
                <input
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Assigning…" : "Create Action"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Alerts() {
  const qc = useQueryClient();
  const { data } = useListAlerts();
  const acknowledge = useAcknowledgeAlert();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const allAlerts = data ?? [];
  const unreadCount = allAlerts.filter((a: any) => !a.acknowledged).length;
  const alerts = allAlerts.filter((a: any) =>
    filter === "unread" ? !a.acknowledged : true,
  );

  const handleMarkAllRead = async () => {
    try {
      await markAllAlertsRead();
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await acknowledge.mutateAsync({ alertId });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries();
    } catch {
      try {
        await api.acknowledgeAlert(alertId);
        qc.invalidateQueries({ queryKey: ["alerts"] });
        qc.invalidateQueries();
      } catch (err: any) {
        console.error("Acknowledge alert error:", err);
      }
    }
  };

  return (
    <Shell>
      <SectionHeading
        eyebrow="Coordination Signals &amp; Early Warnings"
        title="Alerts Center"
        description="Real-time multi-trade warnings about changes, delays, and critical handoff blockers."
        action={
          <Button
            variant="secondary"
            onClick={handleMarkAllRead}
            data-testid="button-mark-all-alerts"
          >
            <Check size={15} /> Mark All Acknowledged
          </Button>
        }
      />

      <section className="panel alerts-panel">
        <div className="alert-toolbar">
          <div className="alert-toolbar-toggle-left">
            <button
              className={`notification-toggle-pill ${filter === "unread" ? "is-unread-only" : "is-all"}`}
              onClick={() => setFilter((prev) => (prev === "unread" ? "all" : "unread"))}
              data-testid="button-notification-toggle-top-left"
              title="Click to toggle between unacknowledged warnings and all signals"
            >
              <Bell size={14} />
              <span>
                <b>{unreadCount}</b> unacknowledged {unreadCount === 1 ? "warning" : "warnings"}
              </span>
              <span className="toggle-badge-status">
                {filter === "unread" ? "Filtered: Unread" : "Toggle Filter"}
              </span>
            </button>
          </div>
          <div className="alert-toolbar-tabs" style={{ display: "flex", gap: "6px" }}>
            <button
              className={filter === "all" ? "filter-tab-active" : ""}
              onClick={() => setFilter("all")}
              data-testid="button-alert-filter-all"
            >
              All Signals ({allAlerts.length})
            </button>
            <button
              className={filter === "unread" ? "filter-tab-active" : ""}
              onClick={() => setFilter("unread")}
              data-testid="button-alert-filter-unread"
            >
              Unacknowledged ({unreadCount})
            </button>
          </div>
        </div>

        <div className="alert-list">
          {alerts.length ? (
            alerts.map((alert: any) => (
              <div
                className={`alert-row ${alert.acknowledged ? "alert-read" : ""}`}
                key={alert.id}
                data-testid={`row-alert-${alert.id}`}
              >
                <div className={`alert-icon ${statusTone(alert.severity)}`}>
                  {alert.type?.toLowerCase().includes("dependency") ? (
                    <GitBranch size={16} />
                  ) : (
                    <AlertTriangle size={16} />
                  )}
                </div>
                <div className="alert-main">
                  <div>
                    <b>{alert.title}</b>
                    <Pill tone={statusTone(alert.severity)}>
                      {alert.severity}
                    </Pill>
                  </div>
                  <p>{alert.description}</p>
                  <small>
                    {formatDate(alert.createdAt)} · Type: {alert.type}
                  </small>
                </div>
                {!alert.acknowledged ? (
                  <Button
                    variant="ghost"
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    disabled={acknowledge.isPending}
                    data-testid={`button-acknowledge-alert-${alert.id}`}
                  >
                    Acknowledge
                  </Button>
                ) : (
                  <span className="acknowledged">
                    <CheckCircle2 size={15} /> Acknowledged
                  </span>
                )}
              </div>
            ))
          ) : (
            <EmptyState
              icon={Bell}
              title="Quiet for now"
              description="No unacknowledged warnings in this category."
            />
          )}
        </div>
      </section>
    </Shell>
  );
}

function Memory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data } = useListMemoryEntries();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [actor, setActor] = useState(user?.name || "David Chen");
  const [type, setType] = useState("decision");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const getLocalDateTimeString = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
  };
  const [eventDate, setEventDate] = useState(getLocalDateTimeString);

  // Strict chronological sorting: newest entries first
  const entries = (data ?? [])
    .filter((item: any) =>
      `${item.title} ${item.description} ${item.actor} ${item.type} ${(item.tags || []).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a: any, b: any) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

  const handleRecordMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await createMemory({
        title,
        description,
        actor,
        type,
        tags: tags.length ? tags : [type.charAt(0).toUpperCase() + type.slice(1)],
        createdAt: eventDate ? new Date(eventDate).toISOString() : new Date().toISOString(),
      });
      qc.invalidateQueries();
      setShowAddModal(false);
      setTitle("");
      setDescription("");
      setTagsInput("");
      setEventDate(getLocalDateTimeString());
    } catch (e: any) {
      alert("Error recording memory: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <SectionHeading
        eyebrow="Immutable Project Memory"
        title="Decisions &amp; Audit Trail"
        description="A searchable chronological record of key decisions, agreements, submittal closures, and resolutions."
        action={
          <Button
            onClick={() => {
              setEventDate(getLocalDateTimeString());
              setShowAddModal(true);
            }}
          >
            <Plus size={16} /> Record Decision / Milestone
          </Button>
        }
      />

      <div className="memory-search">
        <Search size={17} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search decisions, people, packages, date datums..."
          data-testid="input-search-memory"
        />
        <kbd>⌘ K</kbd>
      </div>

      <section className="panel memory-panel">
        <div className="timeline">
          {entries.length ? (
            entries.map((entry: any) => (
              <div
                className="timeline-row"
                key={entry.id}
                data-testid={`row-memory-${entry.id}`}
              >
                <div className="timeline-date">
                  <b>{formatDate(entry.createdAt)}</b>
                  {entry.createdAt && (
                    <span className="timeline-time">{formatTime(entry.createdAt)}</span>
                  )}
                  <small>{entry.type?.toUpperCase()}</small>
                </div>
                <div className="timeline-rail">
                  <span />
                  <i />
                </div>
                <div className="timeline-body">
                  <div className="timeline-heading">
                    <b>{entry.title}</b>
                    <span>recorded by {entry.actor}</span>
                  </div>
                  <p>{entry.description}</p>
                  {entry.tags && Array.isArray(entry.tags) && entry.tags.length > 0 && (
                    <div className="timeline-tags">
                      {entry.tags.map((tag: string) => (
                        <span key={tag} className="timeline-tag-pill">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              icon={Network}
              title="No matching memory entries"
              description="Broaden your search or record a new decision."
            />
          )}
        </div>
      </section>

      {/* Record Decision Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Project Memory</span>
                <h2>Record Decision or Milestone</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRecordMemory}>
              <label>
                Decision / Event Title
                <input
                  required
                  placeholder="e.g. Agreement on master bath Navona Travertine selection"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Event Type
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="decision">Decision</option>
                    <option value="milestone">Milestone</option>
                    <option value="approval">Approval</option>
                    <option value="change">Change</option>
                    <option value="issue">Issue</option>
                    <option value="resolution">Resolution</option>
                  </select>
                </label>
                <label>
                  Event Date &amp; Time
                  <input
                    type="datetime-local"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    required
                  />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label>
                  Recorded By (Actor)
                  <input
                    value={actor}
                    onChange={(e) => setActor(e.target.value)}
                  />
                </label>
                <label>
                  Tags (comma-separated)
                  <input
                    placeholder="e.g. Architecture, MEP, Travertine"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </label>
              </div>
              <label>
                Full Context &amp; Details
                <textarea
                  rows={4}
                  required
                  placeholder="Record the rationale, date, agreements, and stakeholders present..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Recording…" : "Record in Memory"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  confidence?: string;
  sources?: string[];
  timestamp: string;
}

function Ask() {
  const { user } = useAuth();
  const { data: overviewData } = useGetProjectOverview();
  const projectName = overviewData?.project?.name || "Active Project Workspace";
  const chatHistoryEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: `Hello! I am your **${projectName}** Coordination Copilot powered by Gemini.

I have direct access to the entire project memory archive, active work packages, dependency graphs, pending sign-offs, and RACI stakeholder matrices.

Ask me anything about decisions, blast radius impacts, or trade responsibilities!`,
      confidence: "High (Project Memory Verified)",
      sources: [`${projectName} Overview`, "Whole Project Memory Archive"],
      timestamp: "Just now",
    },
  ]);
  const [question, setQuestion] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Auto-scroll chat history when messages change or while thinking
  useEffect(() => {
    chatHistoryEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const suggestions = (overviewData?.project as any)?.isDemo
    ? [
        "What did Marcus Vance decide regarding geothermal HVAC vs split units?",
        "What is the coring rule for the living room cantilever slab?",
        "Why was the 12-meter slimline sliding pocket door delayed?",
        "What is the status of the master bath Italian travertine delivery?",
        "Who is responsible for the structural slab sign-off?",
      ]
    : [
        "What are the critical blockers currently in this project?",
        "Who is responsible for each active work package?",
        "Are there any pending approvals requiring sign-off?",
        "Summarize recent coordination decisions from project memory.",
      ];

  const handleSend = async (queryText = question) => {
    const textToSend = queryText.trim();
    if (!textToSend || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsSending(true);

    try {
      const conversationHistory = messages.slice(-4).map((m) => ({
        role: m.sender === "user" ? "user" : "model",
        text: m.text,
      }));

      const res = await fetch(`${API_BASE}/projects/current/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(localStorage.getItem("coord_token")
            ? { Authorization: `Bearer ${localStorage.getItem("coord_token")}` }
            : {}),
        },
        body: JSON.stringify({
          question: textToSend,
          conversationHistory,
        }),
      });
      const data = await safeParseResponse<any>(res);
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `Server returned HTTP ${res.status}`);
      }
      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        text:
          data.answer || "I could not find matching records for that question.",
        confidence: data.confidence || "High (Project Memory Verified)",
        sources: data.sources || [`${projectName} Intelligence`],
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const fallbackMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text:
          "Apologies, I encountered an issue connecting to the coordination server: " +
          (err.message || "Please retry."),
        confidence: "Low",
        sources: ["Connection Diagnostic"],
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: "welcome",
        sender: "assistant",
        text: `Chat history cleared. How can I assist you with **${projectName}** coordination today?`,
        confidence: "High",
        sources: [`${projectName} Coordination Graph`],
        timestamp: "Just now",
      },
    ]);
  };

  return (
    <Shell>
      <div className="ask-page">
        <div className="ask-intro">
          <div className="ask-orbit">
            <span />
            <span />
            <Bot size={28} />
          </div>
          <div className="eyebrow">{projectName} · Grounded AI Copilot</div>
          <h1>Ask the Project.</h1>
          <p>
            Instant answers synthesized from whole project memory, live activities,
            dependency chains, and blast-radius impacts.
          </p>
        </div>

        {/* Conversational Chat Thread */}
        <div className="chat-container">
          <div className="chat-header-bar">
            <span className="mono-label">
              LIVE COPILOT THREAD ({messages.length} MESSAGES)
            </span>
            <button
              className="button button-ghost button-sm"
              onClick={handleClear}
            >
              <RefreshCw size={12} /> Clear Chat
            </button>
          </div>

          <div className="chat-history">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble chat-${msg.sender}`}>
                <div
                  className={`chat-avatar chat-avatar-${msg.sender === "user" ? "user" : "ai"}`}
                >
                  {msg.sender === "user" ? initials(user?.name || "Project Lead") : <Bot size={18} />}
                </div>
                <div className="chat-body">
                  <div className="chat-bubble-card">
                    {msg.sender === "assistant" ? (
                      <FormattedMessage content={msg.text} />
                    ) : (
                      <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.text}</p>
                    )}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="chat-citations">
                        <span style={{ opacity: 0.7, marginRight: "4px" }}>
                          Sources:
                        </span>
                        {msg.sources.map((s) => (
                          <span key={s} className="citation-pill">
                            <Link2 size={11} /> {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="chat-meta">
                    <span>{msg.timestamp}</span>
                    {msg.confidence && (
                      <Pill tone="teal">{msg.confidence}</Pill>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isSending && (
              <div className="chat-bubble chat-assistant">
                <div className="chat-avatar chat-avatar-ai">
                  <Bot size={18} />
                </div>
                <div className="typing-indicator">
                  <Sparkles size={14} className="spin-icon teal-text" />
                  <span>
                    Synthesizing live {projectName} coordination records...
                  </span>
                </div>
              </div>
            )}
            <div ref={chatHistoryEndRef} />
          </div>

          {/* Prompt Suggestions */}
          <div className="suggestions" style={{ marginTop: "12px" }}>
            <span className="eyebrow">Try asking:</span>
            {suggestions.map((item) => (
              <button
                key={item}
                onClick={() => handleSend(item)}
                disabled={isSending}
                className="suggestion-chip pressable"
                data-testid={`button-suggestion-${item.slice(0, 12).replace(/\s/g, "-")}`}
              >
                {item} <ArrowRight size={13} />
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="ask-box" style={{ marginTop: "12px" }}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything about decisions, blast radius impacts, blocked activities, or trade owners..."
              data-testid="input-project-question"
            />
            <button
              onClick={() => handleSend()}
              disabled={!question.trim() || isSending}
              aria-label="Send question"
              data-testid="button-submit-question"
            >
              <Send size={18} />
            </button>
            <span className="ask-hint">
              Press Enter to send · Grounded in whole project memory
            </span>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const isPublicRoute = [
    "/",
    "/sign-in",
    "/sign-up",
    "/login",
    "/register",
  ].some((path) => location === path || location.startsWith(`${path}/`));

  if (isLoading) return <div className="empty-state">Loading workspace…</div>;
  if (!user && !isPublicRoute) return <LoginPage />;

  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/sign-in/*?" component={() => <LoginPage />} />
        <Route path="/sign-up/*?" component={() => <RegisterPage />} />
        <Route path="/login" component={() => <LoginPage />} />
        <Route path="/register" component={() => <RegisterPage />} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/workspace" component={Dashboard} />
        <Route path="/stakeholders" component={Stakeholders} />
        <Route path="/activities" component={Activities} />
        <Route path="/dependencies" component={Dependencies} />
        <Route path="/changes" component={Changes} />
        <Route path="/changes/:id" component={ChangeImpact} />
        <Route path="/approvals" component={Approvals} />
        <Route path="/actions" component={Actions} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/memory" component={Memory} />
        <Route path="/ask" component={Ask} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
