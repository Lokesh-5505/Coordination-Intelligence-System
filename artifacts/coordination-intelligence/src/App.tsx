import { type ButtonHTMLAttributes, type ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, SignIn as ClerkSignIn, SignUp as ClerkSignUp } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity as ActivityIcon, AlertTriangle, ArrowLeft, ArrowRight, Bell, Bot, Building2,
  Check, CheckCircle2, ChevronDown, CircleDot, Clock3, FileCheck2,
  Filter, GitBranch, LayoutDashboard, Link2, ListChecks, LogIn, Menu, MessageSquare,
  Network, Plus, Search, Send, Sparkles, Target, Users, X, Zap,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams, Router as WouterRouter } from 'wouter';
import {
  getGetChangeImpactQueryKey,
  useAcknowledgeAlert, useAnalyzeChangeImpact, useAskProject, useCreateChange, useGetChangeImpact,
  useGetDailyBriefing, useGetProjectOverview, useListActivities, useListActions, useListAlerts,
  useListApprovals, useListChanges, useListDependencies, useListMemoryEntries, useListStakeholders,
  useUpdateAction, useUpdateApproval,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#e27742',
    colorForeground: '#122333',
    colorMutedForeground: '#667785',
    colorDanger: '#b9403f',
    colorBackground: '#f7f3ee',
    colorInput: '#fffdf9',
    colorInputForeground: '#122333',
    colorNeutral: '#d7d0c7',
    fontFamily: 'DM Sans',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf9] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
  },
};

const navGroups: { label: string; items: [string, string, typeof LayoutDashboard][] }[] = [
  { label: 'Control room', items: [
    ['/dashboard', 'Overview', LayoutDashboard],
    ['/activities', 'Activities', ListChecks],
    ['/dependencies', 'Dependencies', GitBranch],
    ['/changes', 'Changes', Zap],
  ]},
  { label: 'Coordination', items: [
    ['/stakeholders', 'Stakeholders', Users],
    ['/approvals', 'Approvals', FileCheck2],
    ['/actions', 'My actions', Target],
    ['/alerts', 'Alerts', Bell],
  ]},
  { label: 'Project intelligence', items: [
    ['/memory', 'Project memory', Network],
    ['/ask', 'Ask the project', MessageSquare],
  ]},
];

const fallbackOverview = {
  project: { id: 'riverside', name: 'Riverside Mixed-Use Development', location: 'Austin, TX', status: 'On track', progress: 68, phase: 'Structure & envelope', updatedAt: new Date().toISOString() },
  stats: { blocked: 3, overdue: 7, approvals: 4, alerts: 6 },
  briefing: { greeting: 'Good morning, team.', summary: 'The build is moving, but three handoffs need attention before Friday’s coordination stand-up.', items: ['MEP riser coordination is holding up Level 04 framing release.', 'Civil package revision is ready for review from the city consultant.', 'Two procurement decisions will affect the envelope milestone.'], generatedAt: new Date().toISOString() },
  recentActivity: [],
};

function initials(name = '') {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '—';
}

function formatDate(value?: string) {
  if (!value) return 'No date';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function statusTone(value = '') {
  const v = value.toLowerCase();
  if (v.includes('block') || v.includes('risk') || v.includes('overdue') || v.includes('reject')) return 'danger';
  if (v.includes('progress') || v.includes('review') || v.includes('pending') || v.includes('high')) return 'amber';
  if (v.includes('complete') || v.includes('approve') || v.includes('on track') || v.includes('active')) return 'teal';
  return 'slate';
}

function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`} data-testid={`status-${String(children).toLowerCase().replace(/\s/g, '-')}`}>{children}</span>;
}

function Avatar({ name, color = 'orange' }: { name?: string; color?: string }) {
  return <span className={`avatar avatar-${color}`} data-testid={`avatar-${initials(name)}`}>{initials(name)}</span>;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-label="Loading" />;
}

function Button({ children, className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`button button-${variant} pressable ${className}`} {...props}>{children}</button>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading reveal">
    <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {action}
  </div>;
}

function Logo({ dark = false }: { dark?: boolean }) {
  return <Link href="/" className={`brand-mark ${dark ? 'brand-mark-dark' : ''}`} data-testid="link-brand-home">
    <span className="brand-symbol"><span /><span /><span /></span>
    <span><strong>coordination</strong><small>intelligence</small></span>
  </Link>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const active = (path: string) => location === path || (path !== '/dashboard' && location.startsWith(path));
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top"><Logo dark /><button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close menu" data-testid="button-close-menu"><X size={18} /></button></div>
      <div className="project-switcher" data-testid="button-project-switcher"><span className="project-icon"><Building2 size={16} /></span><span><b>Riverside Mixed-Use</b><small>Project workspace</small></span><ChevronDown size={15} /></div>
      <nav className="sidebar-nav">
        {navGroups.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>
          {group.items.map(([path, label, Icon]) => <Link key={path} href={path} onClick={() => setOpen(false)} className={`nav-item ${active(path) ? 'nav-item-active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replace(/\s/g, '-')}`}><Icon size={17} /><span>{label}</span>{label === 'Alerts' && <span className="nav-count">6</span>}</Link>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom"><div className="system-status"><span className="status-pulse" />All systems operational</div><div className="user-chip"><Avatar name="Maya Chen" color="yellow" /><span><b>Maya Chen</b><small>Project lead</small></span><button onClick={() => setLocation('/')} aria-label="Sign out" data-testid="button-sign-out"><ArrowRight size={14} /></button></div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open menu" data-testid="button-open-menu"><Menu size={20} /></button><div className="breadcrumb"><span>Riverside</span><ArrowRight size={13} /><b>{navGroups.flatMap((g) => g.items).find(([path]) => active(path))?.[1] ?? 'Workspace'}</b></div><div className="topbar-actions"><Link href="/ask" className="command-search" data-testid="link-command-search"><Search size={16} /><span>Ask the project</span><kbd>⌘ K</kbd></Link><Link href="/alerts" className="icon-button has-dot" aria-label="Open alerts" data-testid="link-topbar-alerts"><Bell size={18} /></Link><Avatar name="Maya Chen" color="orange" /></div></header>
      <main className="page-content">{children}</main>
    </div>
  </div>;
}

function Landing() {
  return <div className="landing-page">
    <header className="landing-nav"><Logo /><div className="landing-links"><a href="#how-it-works">How it works</a><a href="#signal">Built for the build</a></div><div className="landing-actions"><Link href="/sign-in" className="text-link" data-testid="link-landing-sign-in">Sign in</Link><Link href="/dashboard" className="button button-primary pressable" data-testid="link-landing-demo">Enter demo <ArrowRight size={15} /></Link></div></header>
    <section className="landing-hero grid-blueprint"><div className="hero-copy reveal"><div className="status-tag"><span className="status-pulse" />Live coordination layer</div><h1>Keep the build<br /><em>moving forward.</em></h1><p>Coordination Intelligence turns scattered project signals into one clear view of what changed, what is blocked, and who needs to move next.</p><div className="hero-cta"><Link href="/dashboard" className="button button-primary button-large pressable" data-testid="link-hero-demo">Open Riverside demo <ArrowRight size={17} /></Link><Link href="/sign-in" className="button button-secondary button-large pressable" data-testid="link-hero-sign-in"><LogIn size={16} /> Sign in</Link></div><div className="hero-note"><span className="mini-avatars"><Avatar name="Maya Chen" /><Avatar name="Theo Brooks" color="teal" /><Avatar name="Luca Singh" color="navy" /></span><span>Used daily by the Riverside delivery team</span></div></div><div className="hero-visual reveal reveal-delay-2"><div className="visual-label">RIVERSIDE / CONTROL ROOM <span>08:42:16</span></div><div className="hero-board"><div className="board-top"><span>PROJECT HEALTH</span><Pill tone="teal">On track</Pill></div><div className="board-progress"><strong>68<span>%</span></strong><div><div className="progress-track"><i style={{ width: '68%' }} /></div><small>Structure &amp; envelope · Week 38</small></div></div><div className="signal-grid"><div><b>03</b><span>Blocked</span></div><div><b>07</b><span>Overdue</span></div><div><b>04</b><span>Approvals</span></div></div><div className="board-alert"><AlertTriangle size={15} /><span><b>MEP riser coordination</b> is holding Level 04 framing release.</span><ArrowRight size={15} /></div><div className="board-line"><span><CircleDot size={13} />Next action</span><b>Review revised riser set</b><Avatar name="Nina Alvarez" color="teal" /></div></div><div className="float-card float-card-one"><Sparkles size={14} /><span>Briefing ready</span><b>3 signals to review</b></div><div className="float-card float-card-two"><GitBranch size={14} /><span>Ripple detected</span><b>4 records affected</b></div></div></section>
    <section className="landing-stats" id="signal"><div><b>01</b><span>One source of truth</span><p>Every task, decision, and dependency stays connected to the project context.</p></div><div><b>02</b><span>Clear next actions</span><p>Move from signal to owner without another status meeting or spreadsheet chase.</p></div><div><b>03</b><span>Grounded intelligence</span><p>Ask the project a question and get an answer tied to the records behind it.</p></div></section>
    <section className="landing-section" id="how-it-works"><div className="landing-section-intro"><div className="eyebrow">The coordination layer</div><h2>Less hunting.<br /><span>More building.</span></h2></div><div className="feature-list"><div><span className="feature-index">01</span><div><h3>See the shape of the work</h3><p>Project health, open risk, and the day’s most important movement in a single control room.</p></div><ArrowRight size={18} /></div><div><span className="feature-index">02</span><div><h3>Understand the ripple</h3><p>When a change lands, trace its effect across activities, people, approvals, and dates before it becomes rework.</p></div><ArrowRight size={18} /></div><div><span className="feature-index">03</span><div><h3>Keep momentum visible</h3><p>Give every owner a short list of actions with enough context to close the loop confidently.</p></div><ArrowRight size={18} /></div></div></section>
    <footer className="landing-footer"><Logo /><span>Coordination Intelligence · Built for complex work</span><Link href="/dashboard" data-testid="link-footer-demo">View the demo <ArrowRight size={15} /></Link></footer>
  </div>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignIn = mode === 'sign-in';
  return <div className="auth-page"><div className="auth-aside"><Logo dark /><div><div className="eyebrow">Riverside Mixed-Use Development</div><h1>The next action<br /><em>is already here.</em></h1><p>A coordination workspace for the people moving a complex project forward.</p></div><div className="auth-aside-foot"><span className="status-pulse" />Demo environment · Pune, India</div></div><div className="auth-form-wrap"><div className="auth-form clerk-auth-form"><div className="mobile-auth-logo"><Logo /></div>{isSignIn ? <ClerkSignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <ClerkSignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}<div className="demo-entry"><div><Sparkles size={15} /><b>Just here to look around?</b></div><Link href="/dashboard" data-testid="link-auth-demo">Enter the Riverside demo <ArrowRight size={14} /></Link></div></div></div></div>;
}

function Dashboard() {
  const { data, isLoading, isError } = useGetProjectOverview();
  const briefingQuery = useGetDailyBriefing();
  const overview = data ?? fallbackOverview;
  const briefing = briefingQuery.data ?? overview.briefing;
  return <Shell><SectionHeading eyebrow="Wednesday · October 16, 2024" title="Good morning, Maya." description="Here’s the shape of Riverside today." action={<div className="heading-actions"><span className="last-updated"><span className="status-pulse" />Live data</span><Button variant="secondary" data-testid="button-share-briefing"><Send size={15} /> Share briefing</Button></div>} />
    {isError && <div className="inline-warning" data-testid="status-dashboard-error"><AlertTriangle size={16} /> Live data is catching up. Showing the latest project context.</div>}
    <div className="project-banner reveal reveal-delay-1"><div><span className="eyebrow">Active project</span><h2>{overview.project.name}</h2><p><Building2 size={14} /> {overview.project.location} <span>·</span> <span className="phase-dot" /> {overview.project.phase}</p></div><div className="project-meta"><Pill tone={statusTone(overview.project.status)}>{overview.project.status}</Pill><div className="project-progress"><strong>{overview.project.progress}%</strong><span>overall progress</span><div className="progress-track"><i style={{ width: `${overview.project.progress}%` }} /></div></div></div></div>
    <div className="health-grid reveal reveal-delay-2"><HealthCard label="Blocked work" value={overview.stats.blocked} note="Needs an owner today" icon={CircleDot} tone="danger" href="/activities" /><HealthCard label="Overdue" value={overview.stats.overdue} note="Across 4 workstreams" icon={Clock3} tone="amber" href="/activities" /><HealthCard label="Awaiting approval" value={overview.stats.approvals} note="Decision queue" icon={FileCheck2} tone="slate" href="/approvals" /><HealthCard label="Open alerts" value={overview.stats.alerts} note="Since last briefing" icon={Bell} tone="teal" href="/alerts" /></div>
    <div className="dashboard-grid"><section className="panel briefing-panel reveal reveal-delay-2"><PanelHeader eyebrow="Daily briefing" title={briefing.greeting || 'Project briefing'} action={<span className="mono-label">AI / GROUNDED</span>} /><div className="briefing-summary"><Bot size={20} /><p>{briefing.summary}</p></div><div className="briefing-items">{briefing.items?.map((item: string, i: number) => <div key={item} data-testid={`text-briefing-item-${i}`}><span>{String(i + 1).padStart(2, '0')}</span><p>{item}</p><ArrowRight size={15} /></div>)}</div><Link href="/ask" className="panel-link" data-testid="link-briefing-ask">Ask a follow-up <ArrowRight size={14} /></Link></section><section className="panel reveal reveal-delay-3"><PanelHeader eyebrow="Attention required" title="Open signals" action={<Link href="/alerts" className="panel-link" data-testid="link-view-all-alerts">View all <ArrowRight size={14} /></Link>} /><div className="signal-list"><SignalRow tone="danger" title="Level 04 framing release" meta="Blocked · MEP coordination" /><SignalRow tone="amber" title="Envelope shop drawings" meta="Due today · 2 dependencies" /><SignalRow tone="teal" title="City civil package" meta="Ready for review · 1 approver" /></div><div className="signal-footer"><span>Next coordination window</span><b>Today, 2:30 PM</b></div></section></div>
    <section className="panel activity-panel reveal reveal-delay-4"><PanelHeader eyebrow="Latest movement" title="Project activity" action={<Link href="/memory" className="panel-link" data-testid="link-dashboard-memory">Open memory <ArrowRight size={14} /></Link>} /><div className="activity-feed">{overview.recentActivity?.length ? overview.recentActivity.slice(0, 5).map((event: any) => <div className="feed-row" key={event.id}><Avatar name={event.actor} color="teal" /><div><b>{event.label}</b><p>{event.description}</p></div><time>{formatDate(event.createdAt)}</time></div>) : <EmptyState icon={ActivityIcon} title="No recent movement yet" description="Project updates will appear here as the team moves work forward." compact />}</div></section>
  </Shell>;
}

function HealthCard({ label, value, note, icon: Icon, tone, href }: any) {
  return <Link href={href} className="health-card pressable" data-testid={`link-health-${label.toLowerCase().replace(/\s/g, '-')}`}><div className={`health-icon health-${tone}`}><Icon size={17} /></div><div><span>{label}</span><b>{value}</b><small>{note}</small></div><ArrowRight size={15} /></Link>;
}

function PanelHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) { return <div className="panel-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action}</div>; }
function SignalRow({ tone, title, meta }: { tone: string; title: string; meta: string }) { return <div className="signal-row"><span className={`signal-mark ${tone}`} /><div><b>{title}</b><small>{meta}</small></div><ArrowRight size={15} /></div>; }
function EmptyState({ icon: Icon, title, description, compact = false }: any) { return <div className={`empty-state ${compact ? 'empty-compact' : ''}`}><Icon size={22} /><b>{title}</b><p>{description}</p></div>; }

function Stakeholders() {
  const { data, isLoading } = useListStakeholders();
  const [search, setSearch] = useState('');
  const people = (data ?? []).filter((p: any) => `${p.name} ${p.company} ${p.role}`.toLowerCase().includes(search.toLowerCase()));
  return <Shell><SectionHeading eyebrow="Project network" title="Stakeholders" description="The people who own, influence, and unblock Riverside." action={<Button data-testid="button-invite-stakeholder"><Plus size={16} /> Add stakeholder</Button>} /><div className="toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people, companies, roles" data-testid="input-search-stakeholders" /></div><Button variant="secondary" data-testid="button-filter-stakeholders"><Filter size={15} /> Filter</Button><span className="toolbar-count">{people.length} people</span></div><div className="stakeholder-layout"><section className="panel stakeholder-panel"><PanelHeader eyebrow="Directory" title="Project team" action={<span className="mono-label">UPDATED JUST NOW</span>} />{isLoading ? <div className="stack-gap"><Skeleton className="row-skeleton" /><Skeleton className="row-skeleton" /><Skeleton className="row-skeleton" /></div> : people.length ? <div className="stakeholder-list">{people.map((person: any, i: number) => <div className="stakeholder-row pressable" key={person.id} data-testid={`row-stakeholder-${person.id}`}><Avatar name={person.name} color={['orange', 'teal', 'navy', 'yellow'][i % 4]} /><div className="person-info"><b>{person.name}</b><span>{person.role}</span><small>{person.company}</small></div><div className="person-stats"><span><b>{person.ownedCount}</b> owned</span><span><b>{person.affectedByCount ?? 0}</b> affected</span></div><Pill tone={statusTone(person.status)}>{person.status}</Pill><button className="row-more" aria-label={`Open ${person.name}`} data-testid={`button-open-stakeholder-${person.id}`}><ArrowRight size={15} /></button></div>)}</div> : <EmptyState icon={Users} title="No stakeholders found" description="Try a different search or add the first person to this project." />}</section><aside className="panel matrix-panel"><PanelHeader eyebrow="Responsibility matrix" title="Coverage" /><div className="coverage-graphic"><div className="coverage-center"><Users size={18} /><b>Riverside</b><small>18 active people</small></div><span className="coverage-node node-one">Design<br /><b>04</b></span><span className="coverage-node node-two">Build<br /><b>07</b></span><span className="coverage-node node-three">Client<br /><b>03</b></span><span className="coverage-node node-four">City<br /><b>04</b></span></div><div className="matrix-legend"><span><i className="legend-dot legend-orange" />Direct owner</span><span><i className="legend-dot legend-teal" />Affected</span><span><i className="legend-dot legend-yellow" />Needs clarity</span></div></aside></div></Shell>;
}

function Activities() {
  const { data, isLoading } = useListActivities();
  const [filter, setFilter] = useState('All work');
  const activities = (data ?? []).filter((a: any) => filter === 'All work' || (filter === 'Blocked' ? a.status.toLowerCase().includes('block') : a.type === filter));
  return <Shell><SectionHeading eyebrow="Work register" title="Activities" description="Tasks and deliverables with their owners, dates, and dependencies." action={<Button data-testid="button-add-activity"><Plus size={16} /> Add activity</Button>} /><div className="toolbar"><div className="filter-tabs">{['All work', 'Blocked', 'Design', 'Procurement', 'Construction'].map((item) => <button key={item} className={filter === item ? 'filter-tab-active' : ''} onClick={() => setFilter(item)} data-testid={`button-filter-activity-${item.toLowerCase()}`}>{item}</button>)}</div><Button variant="secondary" data-testid="button-sort-activities"><Clock3 size={15} /> Due date <ChevronDown size={14} /></Button></div><section className="panel table-panel">{isLoading ? <div className="stack-gap"><Skeleton className="table-skeleton" /><Skeleton className="table-skeleton" /><Skeleton className="table-skeleton" /></div> : activities.length ? <div className="data-table"><div className="table-head"><span>Activity / deliverable</span><span>Owner</span><span>Status</span><span>Due</span><span>Links</span><span /></div>{activities.map((item: any) => <div className="table-row" key={item.id} data-testid={`row-activity-${item.id}`}><div className="activity-title"><span className={`type-bar type-${statusTone(item.status)}`} /><div><b>{item.title}</b><small>{item.type}</small>{item.blockedReason && <span className="blocked-note"><AlertTriangle size={12} /> {item.blockedReason}</span>}</div></div><div className="owner-cell"><Avatar name={item.owner} color="teal" /><span>{item.owner}</span></div><Pill tone={statusTone(item.status)}>{item.status}</Pill><span className="date-cell">{formatDate(item.dueDate)}</span><span className="dependency-cell"><Link2 size={14} /> {item.dependencyCount}</span><button className="row-more" aria-label={`Open ${item.title}`} data-testid={`button-open-activity-${item.id}`}><ArrowRight size={15} /></button></div>)}</div> : <EmptyState icon={ListChecks} title="No activities in this view" description="Change the filter or add a work item to get coordination moving." />}</section></Shell>;
}

function Dependencies() {
  const { data, isLoading } = useListDependencies();
  const dependencies = data ?? [];
  return <Shell><SectionHeading eyebrow="Connected work" title="Dependencies" description="See what is waiting on what — before the handoff becomes a delay." action={<Button variant="secondary" data-testid="button-dependency-filter"><Filter size={15} /> Filter graph</Button>} /><div className="dependency-summary"><div><span className="eyebrow">Active chains</span><b>{dependencies.length || 12}</b><small>Across the current phase</small></div><div><span className="eyebrow">At risk</span><b className="danger-text">{dependencies.filter((d: any) => statusTone(d.status) === 'danger').length || 3}</b><small>Need attention today</small></div><div><span className="eyebrow">Longest chain</span><b>06</b><small>Records from design to build</small></div></div><div className="dependency-layout"><section className="panel dependency-graph"><PanelHeader eyebrow="Dependency map" title="Current flow" action={<span className="mono-label">LIVE GRAPH</span>} />{isLoading ? <Skeleton className="graph-skeleton" /> : dependencies.length ? <div className="graph-canvas">{dependencies.slice(0, 7).map((dep: any, i: number) => <div className="graph-edge" key={dep.id} style={{ top: `${12 + i * 12}%` }}><div className={`graph-node ${statusTone(dep.status)}`}><span>{dep.fromTitle}</span><small>{dep.type}</small></div><div className="edge-line"><ArrowRight size={14} /></div><div className={`graph-node ${statusTone(dep.status)}`}><span>{dep.toTitle}</span><small>{dep.status}</small></div></div>)}</div> : <EmptyState icon={GitBranch} title="No dependencies recorded" description="Connected work will appear here once activities are linked." />}</section><aside className="panel ripple-panel"><PanelHeader eyebrow="Change ripple" title="Last analyzed" /><div className="ripple-callout"><Zap size={17} /><div><b>Loading dock access revision</b><p>4 records affected across procurement and site works.</p></div></div><div className="ripple-chain"><span>Change</span><ArrowRight size={13} /><span>Activity</span><ArrowRight size={13} /><span>Approval</span></div><Link href="/changes" className="panel-link" data-testid="link-dependencies-changes">Open change log <ArrowRight size={14} /></Link></aside></div></Shell>;
}

function Changes() {
  const { data } = useListChanges();
  const create = useCreateChange();
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState('Medium');
  const changes = data ?? [];
  const submit = () => { if (!title.trim() || !summary.trim()) return; create.mutate({ data: { title, summary, severity } }, { onSuccess: () => { setCompose(false); setTitle(''); setSummary(''); } }); };
  return <Shell><SectionHeading eyebrow="Decision history" title="Change log" description="A clear record of what shifted, who logged it, and what it touches." action={<Button onClick={() => setCompose(true)} data-testid="button-log-change"><Plus size={16} /> Log a change</Button>} /><div className="change-overview"><div className="change-kicker"><span className="signal-mark amber" /><span><b>{changes.length || 8}</b> changes this phase</span></div><div className="change-kicker"><span className="signal-mark danger" /><span><b>{changes.filter((c: any) => statusTone(c.severity) === 'danger').length || 2}</b> high impact</span></div><div className="change-kicker"><span className="signal-mark teal" /><span><b>92%</b> analyzed within a day</span></div></div><section className="panel table-panel"><div className="change-list">{changes.length ? changes.map((change: any) => <Link href={`/changes/${change.id}`} className="change-row pressable" key={change.id} data-testid={`link-change-${change.id}`}><div className={`change-index ${statusTone(change.severity)}`}>↗</div><div className="change-main"><div><b>{change.title}</b><Pill tone={statusTone(change.severity)}>{change.severity}</Pill></div><p>{change.summary}</p><small>Logged by {change.createdBy} · {formatDate(change.createdAt)}</small></div><div className="change-impact"><b>{change.affectedCount}</b><span>affected records</span></div><div className="change-status"><Pill tone={statusTone(change.status)}>{change.status}</Pill><ArrowRight size={16} /></div></Link>) : <EmptyState icon={Zap} title="No changes logged" description="Log the first change when project context moves." />}</div></section>{compose && <div className="modal-backdrop" onClick={() => setCompose(false)}><div className="modal-card" onClick={(e) => e.stopPropagation()}><div className="modal-header"><div><span className="eyebrow">New record</span><h2>Log a project change</h2></div><button className="icon-button" onClick={() => setCompose(false)} aria-label="Close" data-testid="button-close-change"><X size={18} /></button></div><label>Change title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What shifted?" data-testid="input-change-title" /></label><label>Summary<textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Add enough context for the next person to act." rows={4} data-testid="input-change-summary" /></label><label>Severity<select value={severity} onChange={(e) => setSeverity(e.target.value)} data-testid="select-change-severity"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><div className="modal-actions"><Button variant="secondary" onClick={() => setCompose(false)} data-testid="button-cancel-change">Cancel</Button><Button onClick={submit} disabled={create.isPending} data-testid="button-submit-change">{create.isPending ? 'Saving…' : 'Save change'} <ArrowRight size={15} /></Button></div></div></div>}</Shell>;
}

function ChangeImpact() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: report, isLoading } = useGetChangeImpact(id, { query: { enabled: !!id, queryKey: getGetChangeImpactQueryKey(id) } });
  const analyze = useAnalyzeChangeImpact();
  const impact = report;
  return <Shell><Link href="/changes" className="back-link" data-testid="link-back-changes"><ArrowLeft size={15} /> Back to change log</Link><SectionHeading eyebrow="Impact analysis" title={impact?.headline || (isLoading ? 'Analyzing change…' : 'Change impact report')} description={impact?.explanation || 'Trace affected work, dates, and decisions before the ripple gets expensive.'} action={<Button onClick={() => analyze.mutate({ changeId: id })} disabled={analyze.isPending} variant="secondary" data-testid="button-analyze-impact"><Sparkles size={15} /> {analyze.isPending ? 'Analyzing…' : 'Re-run analysis'}</Button>} />{impact ? <><div className="impact-banner"><div><span className="eyebrow">Schedule impact</span><b>{impact.scheduleImpact}</b></div><Pill tone={statusTone(impact.severity)}>{impact.severity} severity</Pill><div className="impact-divider" /><div><span className="eyebrow">Affected records</span><b>{impact.items?.length ?? 0}</b></div></div><div className="impact-layout"><section className="panel"><PanelHeader eyebrow="Affected records" title="The ripple" /><div className="impact-items">{impact.items?.map((item: any) => <div className="impact-item" key={item.id} data-testid={`row-impact-${item.id}`}><div className={`impact-kind ${statusTone(item.severity)}`}><CircleDot size={15} /></div><div><b>{item.label}</b><p>{item.reason}</p><small>{item.kind} · Owner: {item.owner}</small></div><span className="date-cell">{formatDate(item.dueDate)}</span></div>)}</div></section><aside className="panel"><PanelHeader eyebrow="Suggested follow-through" title="Draft actions" /><div className="draft-actions">{impact.draftActions?.map((action: any) => <div className="draft-action" key={action.id}><span className="check-box"><Check size={13} /></span><div><b>{action.title}</b><small>{action.owner} · {formatDate(action.dueDate)}</small></div><Pill tone={statusTone(action.priority)}>{action.priority}</Pill></div>)}</div><div className="approval-callout"><FileCheck2 size={16} /><div><b>{impact.approvals?.length || 0} approvals may be needed</b><p>Confirm decision owners before issuing the next revision.</p></div></div></aside></div></> : <div className="panel"><EmptyState icon={Sparkles} title={isLoading ? 'Reading project context' : 'Impact report unavailable'} description={isLoading ? 'The analysis is following the project graph.' : 'Try running the analysis again.'} /></div>}</Shell>;
}

function Approvals() {
  const { data } = useListApprovals();
  const update = useUpdateApproval();
  const [tab, setTab] = useState('Needs decision');
  const approvals = (data ?? []).filter((a: any) => tab === 'Needs decision' ? !['approved', 'rejected'].includes(a.status.toLowerCase()) : ['approved', 'rejected'].includes(a.status.toLowerCase()));
  const decide = (id: string, status: string) => update.mutate({ approvalId: id, data: { status } });
  return <Shell><SectionHeading eyebrow="Decision queue" title="Approvals" description="Resolve the decisions that keep other people moving." /><div className="subnav-tabs">{['Needs decision', 'Decision history'].map((item) => <button key={item} className={tab === item ? 'subnav-active' : ''} onClick={() => setTab(item)} data-testid={`button-approval-tab-${item.toLowerCase().replace(/\s/g, '-')}`}>{item}<span>{item === 'Needs decision' ? approvals.length : (data ?? []).length - approvals.length}</span></button>)}</div><section className="panel approval-panel"><div className="approval-list">{approvals.length ? approvals.map((approval: any) => <div className="approval-row" key={approval.id} data-testid={`row-approval-${approval.id}`}><div className="approval-category">{approval.category?.slice(0, 2).toUpperCase()}</div><div className="approval-main"><b>{approval.title}</b><p>Requested by {approval.requester} · Approver: {approval.approver}</p><small>Due {formatDate(approval.dueDate)}</small></div><Pill tone={statusTone(approval.status)}>{approval.status}</Pill>{tab === 'Needs decision' && <div className="approval-actions"><Button variant="secondary" onClick={() => decide(approval.id, 'Rejected')} data-testid={`button-reject-approval-${approval.id}`}>Decline</Button><Button onClick={() => decide(approval.id, 'Approved')} data-testid={`button-approve-approval-${approval.id}`}><Check size={14} /> Approve</Button></div>}</div>) : <EmptyState icon={FileCheck2} title={tab === 'Needs decision' ? 'Queue is clear' : 'No decision history yet'} description={tab === 'Needs decision' ? 'Good work. Nothing is waiting for your decision.' : 'Completed decisions will be recorded here.'} />}</div></section></Shell>;
}

function Actions() {
  const { data } = useListActions();
  const update = useUpdateAction();
  const [tab, setTab] = useState('Open');
  const actions = (data ?? []).filter((a: any) => tab === 'Open' ? !a.status.toLowerCase().includes('complete') : a.status.toLowerCase().includes('complete'));
  return <Shell><SectionHeading eyebrow="Your queue" title="My actions" description="The next clear moves assigned to you across Riverside." action={<Button variant="secondary" data-testid="button-action-filter"><Filter size={15} /> Filter</Button>} /><div className="action-summary"><div><span className="eyebrow">Open actions</span><b>{actions.length || 6}</b><small>Keep your handoffs moving</small></div><div><span className="eyebrow">Due today</span><b className="amber-text">02</b><small>Worth a first look</small></div><div><span className="eyebrow">Closed this week</span><b className="teal-text">11</b><small>Strong finish</small></div></div><div className="subnav-tabs"><button className={tab === 'Open' ? 'subnav-active' : ''} onClick={() => setTab('Open')} data-testid="button-actions-open">Open</button><button className={tab === 'Completed' ? 'subnav-active' : ''} onClick={() => setTab('Completed')} data-testid="button-actions-completed">Completed</button></div><section className="panel actions-panel"><div className="action-list">{actions.length ? actions.map((action: any) => <div className="action-row" key={action.id} data-testid={`row-action-${action.id}`}><button className={`action-check ${action.status.toLowerCase().includes('complete') ? 'checked' : ''}`} onClick={() => update.mutate({ actionId: action.id, data: { status: action.status.toLowerCase().includes('complete') ? 'Open' : 'Completed' } })} aria-label={`Mark ${action.title}`} data-testid={`button-toggle-action-${action.id}`}><Check size={14} /></button><div className="action-main"><div><b>{action.title}</b><Pill tone={statusTone(action.priority)}>{action.priority}</Pill></div><p>From {action.source}</p></div><div className="action-owner"><Avatar name={action.owner} color="teal" /><span>{action.owner}</span></div><div className="action-due"><small>DUE</small><b>{formatDate(action.dueDate)}</b></div><ArrowRight size={16} /></div>) : <EmptyState icon={Target} title="No actions here" description="Your assigned moves will appear as the project changes." />}</div></section></Shell>;
}

function Alerts() {
  const { data } = useListAlerts();
  const acknowledge = useAcknowledgeAlert();
  const alerts = data ?? [];
  return <Shell><SectionHeading eyebrow="Signal centre" title="Alerts" description="Coordination signals that deserve a human response." action={<Button variant="secondary" data-testid="button-mark-all-alerts"><Check size={15} /> Mark all read</Button>} /><section className="panel alerts-panel"><div className="alert-toolbar"><span><b>{alerts.filter((a: any) => !a.acknowledged).length}</b> unread signals</span><div><button className="filter-tab-active" data-testid="button-alert-filter-all">All</button><button data-testid="button-alert-filter-unread">Unread</button></div></div><div className="alert-list">{alerts.length ? alerts.map((alert: any) => <div className={`alert-row ${alert.acknowledged ? 'alert-read' : ''}`} key={alert.id} data-testid={`row-alert-${alert.id}`}><div className={`alert-icon ${statusTone(alert.severity)}`}>{alert.type?.toLowerCase().includes('dependency') ? <GitBranch size={16} /> : <AlertTriangle size={16} />}</div><div className="alert-main"><div><b>{alert.title}</b><Pill tone={statusTone(alert.severity)}>{alert.severity}</Pill></div><p>{alert.description}</p><small>{formatDate(alert.createdAt)} · {alert.type}</small></div>{!alert.acknowledged ? <Button variant="ghost" onClick={() => acknowledge.mutate({ alertId: alert.id })} data-testid={`button-acknowledge-alert-${alert.id}`}>Acknowledge</Button> : <span className="acknowledged"><CheckCircle2 size={15} /> Acknowledged</span>}</div>) : <EmptyState icon={Bell} title="Quiet for now" description="New coordination alerts will land here." />}</div></section></Shell>;
}

function Memory() {
  const { data } = useListMemoryEntries();
  const [search, setSearch] = useState('');
  const entries = (data ?? []).filter((item: any) => `${item.title} ${item.description} ${item.actor} ${item.type}`.toLowerCase().includes(search.toLowerCase()));
  return <Shell><SectionHeading eyebrow="Project record" title="Memory" description="A searchable timeline of the decisions and context behind the build." /><div className="memory-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search decisions, people, packages, dates…" data-testid="input-search-memory" /><kbd>⌘ K</kbd></div><section className="panel memory-panel"><div className="timeline">{entries.length ? entries.map((entry: any, index: number) => <div className="timeline-row" key={entry.id} data-testid={`row-memory-${entry.id}`}><div className="timeline-rail"><span /><i /></div><div className="timeline-date"><b>{formatDate(entry.createdAt)}</b><small>{entry.type}</small></div><div className="timeline-body"><div className="timeline-heading"><b>{entry.title}</b><span>by {entry.actor}</span></div><p>{entry.description}</p><Link href="/ask" className="text-action" data-testid={`link-memory-ask-${index}`}>Ask about this <ArrowRight size={13} /></Link></div></div>) : <EmptyState icon={Network} title="No matching memory" description="Try a broader search term or ask the project directly." />}</div></section></Shell>;
}

function Ask() {
  const ask = useAskProject();
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const suggestions = ['What is most likely to delay the envelope milestone?', 'Who owns the open MEP coordination issue?', 'What changed in the civil package this week?'];
  const submit = (value = question) => { if (!value.trim()) return; setAsked(value); ask.mutate({ data: { question: value } }); setQuestion(''); };
  return <Shell><div className="ask-page"><div className="ask-intro"><div className="ask-orbit"><span /><span /><Bot size={28} /></div><div className="eyebrow">Grounded project Q&amp;A</div><h1>Ask the project.</h1><p>Get a direct answer from the work, decisions, and relationships already in Riverside.</p></div><div className="ask-box"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder="Ask about a person, activity, change, or decision…" data-testid="input-project-question" /><button onClick={() => submit()} disabled={!question.trim() || ask.isPending} aria-label="Send question" data-testid="button-submit-question"><Send size={18} /></button><span className="ask-hint">Press Enter to ask · grounded in Riverside records</span></div>{!asked && <div className="suggestions"><span className="eyebrow">Try asking</span>{suggestions.map((item) => <button key={item} onClick={() => submit(item)} className="suggestion-chip pressable" data-testid={`button-suggestion-${item.slice(0, 12).replace(/\s/g, '-')}`}>{item}<ArrowUpRightIcon /></button>)}</div>}{asked && <section className="answer-card panel">{ask.isPending ? <><Skeleton className="answer-line" /><Skeleton className="answer-line short" /></> : ask.data ? <><div className="answer-head"><div><span className="eyebrow">Project answer</span><h2>{asked}</h2></div><Pill tone="teal">{ask.data.confidence} confidence</Pill></div><p className="answer-copy">{ask.data.answer}</p><div className="source-list"><span className="eyebrow">Sources in project memory</span>{ask.data.sources?.map((source: string) => <span key={source}><Link2 size={13} /> {source}</span>)}</div></> : <EmptyState icon={Bot} title="No answer returned" description="Try asking the question another way." />}</section>}</div></Shell>;
}

function ArrowUpRightIcon() { return <ArrowRight size={14} />; }

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={Landing} />
    <Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} />
    <Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} />
    <Route path="/dashboard" component={Dashboard} />
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
  </Switch></RoutedErrorBoundary>;
}

function App() {
  if (!clerkPubKey) {
    return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
  }
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}><QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider></ClerkProvider>;
}

export default App;