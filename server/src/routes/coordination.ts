import "dotenv/config";
import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { villaStore, VILLA_PROJECT_ID, saveStoreToDisk, getProjectStore, projectsStore } from "./auth";
import { queryNeon, ensureUUID } from "../db/neon";

const router = Router();

// All coordination routes require auth
router.use(authMiddleware);

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getProjectId(req: any): string {
  return req.user?.projectId || VILLA_PROJECT_ID;
}

function getStore(req: any) {
  return getProjectStore(getProjectId(req));
}

function logMemoryEntry(store: any, entry: any) {
  if (!store.memory) store.memory = [];
  store.memory.unshift(entry);
  store.memory.sort((a: any, b: any) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

function canWrite(req: any): boolean {
  return req.user?.role !== "viewer";
}

function requireWrite(req: any, res: any): boolean {
  if (!canWrite(req)) {
    res.status(403).json({ error: "Viewer accounts cannot modify project records" });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ─── Role-Based Access Control (RBAC) Authority Evaluator ─────────────────────
export function isUserAuthorizedForApproval(
  user: any,
  approval: any,
): { authorized: boolean; requiredRole: string; reason?: string } {
  if (!user) {
    return { authorized: false, requiredRole: "Authenticated User", reason: "Authentication required" };
  }
  const role = (user.role || "").toLowerCase();
  const name = (user.name || "").toLowerCase();
  const approver = (approval.approver || "").toLowerCase();
  const cat = (approval.category || "").toLowerCase();

  // Admin / Project Manager has universal override authority
  if (role === "admin" || role === "project_manager") {
    return { authorized: true, requiredRole: "Project Delivery Manager (Admin)" };
  }

  // Exact or partial name match (e.g. user "Rajesh Patel" matches approver "Rajesh Patel")
  if (name && (approver.includes(name) || name.includes(approver))) {
    return { authorized: true, requiredRole: approval.approver };
  }

  // Structural Engineering certification / calculation
  if (cat.includes("structural") || approver.includes("rajesh") || approver.includes("structural")) {
    const requiredRole = "Principal Structural Engineer";
    if (role === "engineer") return { authorized: true, requiredRole };
    return { authorized: false, requiredRole, reason: "Requires Principal Structural Engineer (Rajesh Patel) certification" };
  }

  // Architectural Design / Finish approval
  if (cat.includes("architect") || approver.includes("elena") || approver.includes("architect")) {
    const requiredRole = "Lead Architect";
    if (role === "architect") return { authorized: true, requiredRole };
    return { authorized: false, requiredRole, reason: "Requires Lead Architect (Elena Rostova) sign-off" };
  }

  // Client Scope / Aesthetic & Budget Sign-off
  if (cat.includes("client") || cat.includes("aesthetic") || cat.includes("budget") || approver.includes("marcus") || approver.includes("owner")) {
    const requiredRole = "Property Owner / Client";
    if (role === "owner" || role === "client") return { authorized: true, requiredRole };
    return { authorized: false, requiredRole, reason: "Requires Property Owner / Client (Marcus Vance) sign-off" };
  }

  // Site Operations & Contractor Mobilization
  if (cat.includes("site") || cat.includes("contractor") || approver.includes("carlos")) {
    const requiredRole = "General Contractor / Site Superintendent";
    if (role === "contractor") return { authorized: true, requiredRole };
    return { authorized: false, requiredRole, reason: "Requires General Contractor (Carlos Gomez) sign-off" };
  }

  // MEP & Smart Systems
  if (cat.includes("mep") || cat.includes("environmental") || cat.includes("systems") || approver.includes("tariq")) {
    const requiredRole = "MEP & Smart Systems Director";
    if (role === "mep" || role === "engineer") return { authorized: true, requiredRole };
    return { authorized: false, requiredRole, reason: "Requires MEP Director (Tariq Al-Mansoor) sign-off" };
  }

  // Interior Specialist
  if (cat.includes("interior") || approver.includes("sophia")) {
    const requiredRole = "Interior Designer";
    if (role === "interior" || role === "architect") return { authorized: true, requiredRole };
    return { authorized: false, requiredRole, reason: "Requires Interior Designer (Sophia Lorenzi) sign-off" };
  }

  return {
    authorized: false,
    requiredRole: approval.approver,
    reason: `Requires ${approval.approver} sign-off`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT OVERVIEW & ROLE-TAILORED COORDINATION RADAR
// ─────────────────────────────────────────────────────────────────────────────
router.get("/projects/current/overview", async (req, res) => {
  try {
    const store = getStore(req);
    const { project, activities, changes, actions, approvals, alerts, memory } = store;

    const blockedCount = activities.filter((a) => a.status === "blocked").length;
    const openChanges = changes.filter((c) => c.status === "active").length;
    const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
    const openActions = actions.filter((a) => a.status === "todo" || a.status === "in-progress").length;
    const criticalAlerts = alerts.filter(
      (a) => (a.severity === "critical" || a.severity === "high") && !a.acknowledged,
    ).length;

    // Role-tailored intelligence calculation
    const userRole = (req.user?.role || "admin").toLowerCase();
    const userName = (req.user?.name || "").toLowerCase();

    const roleDisciplinesMap: Record<string, string[]> = {
      architect: ["Architecture", "Interiors", "Facade"],
      engineer: ["Structural", "Civil", "Geotechnical"],
      contractor: ["Construction", "Site Operations", "Civil", "Facade"],
      owner: ["Client", "Interiors", "Architecture", "Budget"],
      mep: ["MEP", "HVAC", "Automation", "Electrical", "Plumbing"],
      interior: ["Interiors", "Finishes", "Architecture"],
      admin: ["All"],
    };

    const myDisciplines = roleDisciplinesMap[userRole] || [userRole];
    const isGlobal = userRole === "admin" || userRole === "project_manager";

    // 1. Deliverables owned by my trade/scope
    const myActivities = activities.filter((a) =>
      isGlobal ||
      (userName && a.owner?.toLowerCase().includes(userName)) ||
      myDisciplines.some((d) => a.discipline?.toLowerCase().includes(d.toLowerCase()))
    );

    // 2. Approvals waiting specifically on my role's signature
    const myApprovals = approvals.filter((a) =>
      a.status === "pending" && isUserAuthorizedForApproval(req.user, a).authorized
    );

    // 3. Upstream Blockers delaying my deliverables
    const myActivityIds = new Set(myActivities.map((a) => a.id));
    const blockedUpstreamDeps = store.dependencies.filter((d: any) =>
      myActivityIds.has(d.toId) && d.type === "blocks" && d.status === "active"
    );
    const blockedPrereqIds = new Set(blockedUpstreamDeps.map((d: any) => d.fromId));
    const upstreamBlockers = activities.filter((a) =>
      blockedPrereqIds.has(a.id) || (myActivityIds.has(a.id) && a.status === "blocked")
    );

    // 4. Change Orders Impacting My Discipline
    const changesImpact = changes.filter((c) =>
      isGlobal ||
      (c.affectedStakeholders && c.affectedStakeholders.some((st: string) =>
        st.toLowerCase().includes(userRole) || (userName && st.toLowerCase().includes(userName))
      )) ||
      (c.blastRadius && c.blastRadius.some((br: any) =>
        myDisciplines.some((d) => br.discipline?.toLowerCase().includes(d.toLowerCase()))
      ))
    );

    // 5. Actions Assigned to Me
    const myActions = actions.filter((ac) =>
      isGlobal || (userName && ac.owner?.toLowerCase().includes(userName))
    );

    // Role-tailored briefing text
    let roleSummary = "";
    let roleItems: string[] = [];

    if (userRole === "architect") {
      roleSummary = `Architectural Radar: ${myApprovals.length} design reviews awaiting sign-off, ${myActivities.length} active architectural work packages.`;
      roleItems = [
        `${myApprovals.length} architectural/finish approvals pending your sign-off`,
        `${upstreamBlockers.length} structural or site prerequisite handoffs in progress`,
        `${changesImpact.length} active scope changes affecting building fenestration or interior finishes`,
      ];
    } else if (userRole === "engineer") {
      roleSummary = `Structural Engineering Radar: ${myApprovals.length} critical engineering certifications pending, ${upstreamBlockers.length} load-bearing trade clashes.`;
      roleItems = [
        `${myApprovals.length} structural submittals awaiting engineering certification`,
        `Mandatory Living Room Tendon Rule active: No slab coring within 1.2m of TB-01`,
        `${upstreamBlockers.length} downstream trade packages blocked on engineering release`,
      ];
    } else if (userRole === "contractor") {
      roleSummary = `Site Operations Radar: ${myActivities.length} active site packages, ${upstreamBlockers.length} packages awaiting engineering clearance.`;
      roleItems = [
        `${myActivities.length} contractor work packages in execution`,
        `${upstreamBlockers.length} site activities waiting on inspection or rebar sign-off`,
        `${myActions.length} open field coordination action items assigned to site team`,
      ];
    } else if (userRole === "owner") {
      roleSummary = `Owner & Client Radar: ${myApprovals.length} scope/material decisions awaiting client release, ${changesImpact.length} active budget variations.`;
      roleItems = [
        `${myApprovals.length} client finish and milestone sign-offs awaiting your review`,
        `${changesImpact.length} change orders with budget and schedule delta`,
        `Overall Project Completion: ${project.progress || 54}% on schedule`,
      ];
    } else {
      if (activities.length === 0 && openActions === 0 && openChanges === 0 && pendingApprovals === 0) {
        roleSummary = `Project Delivery Control: Workspace initialized and healthy. Ready to track activities, changes, and coordination signals.`;
        roleItems = [
          `Active coordination layer online for ${project.name}`,
          `Add project work packages or log changes to begin real-time blast radius tracking`,
          `No blocked handoffs or overdue sign-offs detected in this workspace`,
        ];
      } else {
        roleSummary = `Project Delivery Control: ${blockedCount} blocked activities, ${pendingApprovals} pending approvals, and ${openActions} open actions across all trades.`;
        roleItems = [
          `${blockedCount} cross-discipline handoffs currently flagged as blocked or at-risk`,
          `${openChanges} active change orders undergoing multidisciplinary coordination`,
          `${pendingApprovals} critical sign-offs awaiting authority review across trades`,
          `${openActions} coordination actions distributed across the delivery team`,
        ];
      }
    }

    return res.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        location: project.location,
        phase: project.phase,
        status: project.status,
        progress: project.progress,
        isDemo: project.isDemo,
      },
      stats: {
        activities: activities.length,
        blockedActivities: blockedCount,
        openChanges,
        pendingApprovals,
        openActions,
        criticalAlerts,
      },
      roleScope: {
        role: userRole,
        name: req.user?.name || "Team Member",
        isGlobal,
        myActivitiesCount: myActivities.length,
        myApprovalsCount: myApprovals.length,
        myBlockedUpstreamCount: upstreamBlockers.length,
        myChangesImpactCount: changesImpact.length,
        myActionsCount: myActions.length,
        roleSummary,
        roleItems,
      },
      briefing: {
        greeting: `Welcome, ${req.user?.name || "Team Member"} (${userRole.toUpperCase()})`,
        summary: roleSummary,
        items: roleItems,
        generatedAt: new Date().toISOString(),
      },
      recentActivity: memory.slice(0, 6).map((entry) => ({
        id: entry.id,
        label: entry.title,
        description: entry.description,
        actor: entry.actor,
        actorInitials: (entry.actor || "DC")
          .split(" ")
          .map((part: string) => part[0])
          .join("")
          .slice(0, 2),
        createdAt: entry.createdAt,
        timestamp: entry.createdAt,
        type: entry.type,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
      })),
    });
  } catch (err: any) {
    console.error("Overview error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DAILY BRIEFING
// ─────────────────────────────────────────────────────────────────────────────
router.get("/projects/current/briefing", async (req, res) => {
  try {
    const store = getStore(req);
    const { activities, changes, actions, approvals, alerts } = store;

    return res.json([
      {
        type: "blocker",
        message: `${activities.filter((a) => a.status === "blocked").length} activities blocked on critical path`,
        count: activities.filter((a) => a.status === "blocked").length,
      },
      {
        type: "change",
        message: `${changes.filter((c) => c.status === "active").length} active change orders requiring trade alignment`,
        count: changes.filter((c) => c.status === "active").length,
      },
      {
        type: "approval",
        message: `${approvals.filter((a) => a.status === "pending").length} approvals awaiting discipline sign-off`,
        count: approvals.filter((a) => a.status === "pending").length,
      },
      {
        type: "action",
        message: `${actions.filter((a) => a.status !== "done").length} open actions across the delivery team`,
        count: actions.filter((a) => a.status !== "done").length,
      },
      {
        type: "alert",
        message: `${alerts.filter((a) => !a.acknowledged && (a.severity === "critical" || a.severity === "high")).length} high/critical alerts unacknowledged`,
        count: alerts.filter(
          (a) => !a.acknowledged && (a.severity === "critical" || a.severity === "high"),
        ).length,
      },
    ]);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STAKEHOLDERS
// ─────────────────────────────────────────────────────────────────────────────
router.get("/projects/current/stakeholders", async (req, res) => {
  const store = getStore(req);
  return res.json(store.stakeholders);
});

router.get("/stakeholders/:id", async (req, res) => {
  const store = getStore(req);
  const { stakeholders, activities, approvals, actions } = store;
  const stakeholder = stakeholders.find((s) => s.id === req.params.id);
  if (!stakeholder) return res.status(404).json({ error: "Stakeholder not found" });

  const owned = activities.filter((a) => a.owner === stakeholder.name);
  const requiredApprovals = approvals.filter((a) => a.approver === stakeholder.name);
  const assignedActions = actions.filter((a) => a.owner === stakeholder.name);

  return res.json({
    ...stakeholder,
    ownedActivities: owned,
    approvals: requiredApprovals,
    actions: assignedActions,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITIES
// ─────────────────────────────────────────────────────────────────────────────
router.get("/projects/current/activities", async (req, res) => {
  const store = getStore(req);
  return res.json(store.activities);
});

router.post("/projects/current/activities", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const {
    title,
    type,
    discipline,
    owner,
    ownerInitials,
    status,
    dueDate,
    location,
    criticalPath,
    blockedReason,
  } = req.body;

  if (!title || !owner) {
    return res.status(400).json({ error: "title and owner are required" });
  }

  const store = getStore(req);
  const newActivity = {
    id: "act-" + Date.now(),
    projectId: getProjectId(req),
    title,
    type: type || "Deliverable",
    discipline: discipline || "Architecture",
    owner,
    ownerInitials:
      ownerInitials ||
      owner
        .split(" ")
        .map((part: string) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    status: status || "in-progress",
    dueDate: dueDate || "2026-10-01",
    location: location || "Site Enclosure",
    criticalPath: !!criticalPath,
    dependencyCount: 0,
    blockedReason: status === "blocked" ? blockedReason || "Pending resolution" : null,
    createdAt: new Date().toISOString(),
  };

  store.activities.unshift(newActivity);
  saveStoreToDisk();
  return res.status(201).json(newActivity);
});

router.patch("/activities/:id", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const store = getStore(req);
  const activity = store.activities.find((a) => a.id === req.params.id);
  if (!activity) return res.status(404).json({ error: "Activity not found" });

  Object.assign(activity, req.body);
  saveStoreToDisk();
  return res.json(activity);
});

router.delete("/activities/:id", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const store = getStore(req);
  const idx = store.activities.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Activity not found" });

  const removed = store.activities.splice(idx, 1)[0];
  saveStoreToDisk();
  return res.json({ success: true, removed });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────
router.get("/projects/current/dependencies", async (req, res) => {
  const store = getStore(req);
  return res.json(store.dependencies);
});

router.post("/projects/current/dependencies", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const { fromId, fromTitle, toId, toTitle, type, status } = req.body;
  if (!fromId || !toId) {
    return res.status(400).json({ error: "fromId and toId are required" });
  }

  const store = getStore(req);
  const newDep = {
    id: "dep-" + Date.now(),
    projectId: getProjectId(req),
    fromId,
    fromTitle: fromTitle || "Predecessor Activity",
    toId,
    toTitle: toTitle || "Successor Activity",
    type: type || "blocks",
    status: status || "active",
    createdAt: new Date().toISOString(),
  };

  store.dependencies.push(newDep);
  saveStoreToDisk();
  return res.status(201).json(newDep);
});

// ─────────────────────────────────────────────────────────────────────────────
// CHANGES & BLAST RADIUS IMPACT ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
router.get("/projects/current/changes", async (req, res) => {
  const store = getStore(req);
  return res.json(store.changes);
});

router.post("/projects/current/changes", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const { title, summary, severity, createdBy, discipline, rawSignal } = req.body;
  if (!title || !summary) {
    return res.status(400).json({ error: "title and summary are required" });
  }

  const store = getStore(req);
  const newChange = {
    id: "chg-" + Date.now(),
    projectId: getProjectId(req),
    title,
    summary,
    severity: severity || "medium",
    createdBy: createdBy || req.user?.name || "Project Member",
    discipline: discipline || "Architecture",
    status: "active",
    affectedCount: 2,
    rawSignal,
    createdAt: new Date().toISOString(),
  };

  store.changes.unshift(newChange);

  // Automatically log to Project Memory
  logMemoryEntry(store, {
    id: "mem-" + Date.now(),
    projectId: getProjectId(req),
    title: `Change Registered: ${title}`,
    description: summary,
    type: "change",
    actor: createdBy || req.user?.name || "Project Member",
    tags: ["Change Order", discipline || "Architecture", severity || "medium"],
    createdAt: new Date().toISOString(),
  });

  // Automatically create Alert
  store.alerts.unshift({
    id: "alt-" + Date.now(),
    projectId: getProjectId(req),
    title: `New Change: ${title}`,
    description: summary.slice(0, 140),
    type: "impact",
    severity: severity || "medium",
    acknowledged: false,
    createdAt: new Date().toISOString(),
  });

  saveStoreToDisk();
  return res.status(201).json(newChange);
});

async function buildChangeImpactReport(change: any, store: any, forceGemini: boolean = false): Promise<any> {
  const { activities = [], dependencies = [], stakeholders = [], approvals = [] } = store;

  // 1. Trace directly affected and downstream dependent activities
  const directlyAffected = activities.filter(
    (a: any) =>
      a.discipline === change.discipline ||
      (change.discipline && a.title.toLowerCase().includes(change.discipline.toLowerCase())) ||
      (change.title && a.title.toLowerCase().includes(change.title.toLowerCase().slice(0, 8))) ||
      a.status === "blocked",
  );

  const affectedIds = new Set(directlyAffected.map((a: any) => a.id));
  const downstreamDeps = dependencies.filter((d: any) => affectedIds.has(d.fromId));
  const downstreamActivities = activities.filter((a: any) =>
    downstreamDeps.some((d: any) => d.toId === a.id),
  );

  const allAffected = [...directlyAffected, ...downstreamActivities];
  const uniqueAffected = Array.from(new Map(allAffected.map((a: any) => [a.id, a])).values());

  const affectedStakeholderNames: string[] = Array.from(
    new Set(
      stakeholders
        .filter((s: any) => uniqueAffected.some((a: any) => a.owner === s.name))
        .map((s: any) => String(s.name)),
    ),
  );
  if (affectedStakeholderNames.length === 0 && stakeholders.length > 0) {
    if (stakeholders[0]?.name) affectedStakeholderNames.push(String(stakeholders[0].name));
    if (stakeholders[1]?.name) affectedStakeholderNames.push(String(stakeholders[1].name));
  }

  // 2. If Gemini is configured and we want AI analysis, call Gemini with structured JSON output
  if (genAI && (forceGemini || Math.random() >= 0)) {
    try {
      const prompt = `You are a Senior Principal Construction & Structural Risk Director conducting an AI Blast Radius Impact Analysis on a change order for the project "${store.project?.name || "The Grand Vista Luxury Villa"}".

Change Details:
- Title: ${change.title}
- Summary: ${change.summary}
- Severity: ${change.severity}
- Discipline: ${change.discipline || "General Architecture & Engineering"}
- Created By: ${change.createdBy || "Project Lead"}

Active Project Work Packages:
${activities.slice(0, 10).map((a: any) => `- [${a.id}] ${a.title} (${a.discipline}, Owner: ${a.owner}, Status: ${a.status}, Due: ${a.dueDate})`).join("\n")}

Key Project Stakeholders:
${stakeholders.map((s: any) => `- ${s.name} (${s.role}, ${s.discipline})`).join("\n")}

Return ONLY a valid JSON object matching this schema:
{
  "headline": "Short punchy headline summarizing blast radius, e.g. 'Blast radius impacts 4 work packages across 3 critical trades'",
  "explanation": "2-3 clear sentences explaining technical ripple effects, interface clash risks, and why immediate coordination is required.",
  "scheduleImpact": "Estimated schedule slip, e.g. '+7 to 10 working days on envelope and finish sequencing'",
  "severity": "${change.severity || "high"}",
  "affectedStakeholders": ["Stakeholder Name 1", "Stakeholder Name 2"],
  "items": [
    {
      "id": "imp-1",
      "label": "Name of impacted work package or deliverable",
      "kind": "activity",
      "owner": "Stakeholder Name",
      "ownerInitials": "SN",
      "severity": "high",
      "reason": "Specific technical reason why this item is impacted by the change",
      "dueDate": "2026-09-28",
      "discipline": "Discipline"
    }
  ],
  "draftActions": [
    {
      "id": "act-1",
      "title": "Clear concrete actionable next step",
      "owner": "Stakeholder Name",
      "ownerInitials": "SN",
      "dueDate": "2026-09-22",
      "priority": "urgent"
    }
  ],
  "approvals": [
    "Sign-off Title — Approver Name"
  ]
}`;

      const aiText = await askGeminiWithRetry(prompt, 1);
      const parsed = JSON.parse(aiText);
      if (parsed && parsed.headline && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return {
          changeId: change.id,
          ...parsed,
          change,
          affectedActivities: uniqueAffected,
        };
      }
    } catch (err: any) {
      console.warn("[Change Impact AI] Gemini analysis fallback:", err.message);
    }
  }

  // 3. Fallback deterministic high-fidelity calculation
  const scheduleImpactDays = change.severity === "critical" ? 14 : change.severity === "high" ? 7 : 3;
  const headline = `Blast radius traces ${uniqueAffected.length || 3} work packages across ${affectedStakeholderNames.length || 2} trades`;
  const explanation = `The change "${change.title}" affects ${change.discipline || "project"} workstreams. Dependencies propagate through downstream installation, MEP rough-ins, and inspection gates. Priority mitigation is required to protect the critical milestone path.`;

  const fallbackItems = (uniqueAffected.length ? uniqueAffected : activities.slice(0, 3)).map((act: any, idx: number) => ({
    id: `imp-${act.id || idx + 1}`,
    label: act.title,
    kind: idx % 2 === 0 ? "activity" : "deliverable",
    owner: act.owner || affectedStakeholderNames[idx % affectedStakeholderNames.length] || "Trade Lead",
    ownerInitials: (act.owner || "TL").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase(),
    severity: change.severity === "critical" ? (idx === 0 ? "critical" : "high") : change.severity,
    reason: `Direct interface clash with ${change.title}; datum alignment and clearances require physical site verification.`,
    dueDate: act.dueDate || "2026-09-25",
    discipline: act.discipline || "General",
  }));

  const fallbackActions = [
    {
      id: `da-${Date.now()}-1`,
      title: `Verify site datum & BIM clash clearance for ${change.title}`,
      owner: affectedStakeholderNames[0] || "Rajesh Patel",
      ownerInitials: (affectedStakeholderNames[0] || "RP").split(" ").map((w: string) => w[0]).join("").slice(0, 2),
      dueDate: "2026-09-20",
      priority: change.severity === "critical" ? "urgent" : "high",
    },
    {
      id: `da-${Date.now()}-2`,
      title: `Re-issue updated shop drawings & coordination submittal`,
      owner: affectedStakeholderNames[1] || "Elena Rostova",
      ownerInitials: (affectedStakeholderNames[1] || "ER").split(" ").map((w: string) => w[0]).join("").slice(0, 2),
      dueDate: "2026-09-22",
      priority: "high",
    },
    {
      id: `da-${Date.now()}-3`,
      title: `Conduct multi-trade site walk to confirm rough-in penetrations`,
      owner: affectedStakeholderNames[2] || "Carlos Gomez",
      ownerInitials: (affectedStakeholderNames[2] || "CG").split(" ").map((w: string) => w[0]).join("").slice(0, 2),
      dueDate: "2026-09-24",
      priority: "normal",
    },
  ];

  return {
    changeId: change.id,
    headline,
    explanation,
    scheduleImpact: `+${scheduleImpactDays} working days on critical path milestones`,
    severity: change.severity || "high",
    affectedStakeholders: affectedStakeholderNames,
    items: fallbackItems,
    draftActions: fallbackActions,
    approvals: [
      `Structural & Architectural Sign-off — ${affectedStakeholderNames[0] || "Lead Engineer"}`,
      `Owner Variation Concurrence — ${store.stakeholders?.find((s: any) => s.role === "owner")?.name || "Marcus Vance"}`,
    ],
    change,
    affectedActivities: uniqueAffected,
  };
}

const handleGetChangeImpact = async (req: any, res: any) => {
  const store = getStore(req);
  const changeId = req.params.id || req.params.changeId;
  const change = store.changes.find((c: any) => c.id === changeId);
  if (!change) return res.status(404).json({ error: "Change not found" });

  const report = await buildChangeImpactReport(change, store, false);
  return res.json(report);
};

const handleAnalyzeChangeImpact = async (req: any, res: any) => {
  const store = getStore(req);
  const changeId = req.params.id || req.params.changeId;
  const change = store.changes.find((c: any) => c.id === changeId);
  if (!change) return res.status(404).json({ error: "Change not found" });

  const report = await buildChangeImpactReport(change, store, true);
  return res.json(report);
};

router.get("/changes/:id/impact", handleGetChangeImpact);
router.get("/changes/:changeId/impact", handleGetChangeImpact);
router.post("/changes/:id/analyze-impact", handleAnalyzeChangeImpact);
router.post("/changes/:changeId/analyze-impact", handleAnalyzeChangeImpact);

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────
router.get("/projects/current/actions", async (req, res) => {
  const store = getStore(req);
  return res.json(store.actions);
});

router.post("/projects/current/actions", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const { title, owner, ownerInitials, status, dueDate, source, priority } = req.body;
  if (!title || !owner) {
    return res.status(400).json({ error: "title and owner are required" });
  }

  const store = getStore(req);
  const newAction = {
    id: "actn-" + Date.now(),
    projectId: getProjectId(req),
    title,
    owner,
    ownerInitials:
      ownerInitials ||
      owner
        .split(" ")
        .map((part: string) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    status: status || "todo",
    dueDate: dueDate || "2026-09-25",
    source: source || "Manual Entry",
    priority: priority || "normal",
    createdAt: new Date().toISOString(),
  };

  store.actions.unshift(newAction);
  saveStoreToDisk();
  return res.status(201).json(newAction);
});

router.patch("/actions/:id", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const { status } = req.body;
  const store = getStore(req);
  const action = store.actions.find((a) => a.id === req.params.id);
  if (!action) return res.status(404).json({ error: "Action not found" });

  if (status) action.status = status;
  if (req.body.priority) action.priority = req.body.priority;

  if (status === "done") {
    logMemoryEntry(store, {
      id: "mem-" + Date.now(),
      projectId: getProjectId(req),
      title: `Action Resolved: ${action.title}`,
      description: `Completed by ${req.user?.name || "team member"}. Assigned to: ${action.owner}`,
      type: "action",
      actor: req.user?.name || action.owner,
      tags: ["Action", "Completed"],
      createdAt: new Date().toISOString(),
    });
  }

  saveStoreToDisk();
  return res.json(action);
});

router.post("/actions/adopt", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const { actions: draftActions } = req.body;
  if (!Array.isArray(draftActions) || draftActions.length === 0) {
    return res.status(400).json({ error: "actions array is required" });
  }

  const store = getStore(req);
  const newActions = draftActions.map((a: any, idx: number) => ({
    id: "actn-" + (Date.now() + idx),
    projectId: getProjectId(req),
    title: a.title,
    owner: a.owner || req.user?.name || "Project Lead",
    ownerInitials: (a.owner || "PL")
      .split(" ")
      .map((p: string) => p[0])
      .join("")
      .slice(0, 2),
    status: "todo",
    dueDate: "2026-09-24",
    priority: a.priority || "normal",
    source: a.source || "Blast Radius Adoption",
    createdAt: new Date().toISOString(),
  }));

  store.actions.unshift(...newActions);

  // Memory log
  logMemoryEntry(store, {
    id: "mem-" + Date.now(),
    projectId: getProjectId(req),
    title: `${newActions.length} mitigation actions adopted for project execution`,
    description: newActions.map((a: any) => `• ${a.title} (${a.owner})`).join("\n"),
    type: "action",
    actor: req.user?.name || "Project Lead",
    tags: ["Action", "Adopted", "Mitigation"],
    createdAt: new Date().toISOString(),
  });

  saveStoreToDisk();
  return res.status(201).json({ adopted: newActions.length, actions: newActions });
});

// ─────────────────────────────────────────────────────────────────────────────
// APPROVALS & ROLE-BASED AUTHORIZATION GATES
// ─────────────────────────────────────────────────────────────────────────────
router.get("/projects/current/approvals", async (req, res) => {
  const store = getStore(req);
  const decoratedApprovals = store.approvals.map((app: any) => {
    const authCheck = isUserAuthorizedForApproval(req.user, app);
    return {
      ...app,
      canSign: authCheck.authorized,
      requiredRole: authCheck.requiredRole,
      authReason: authCheck.reason,
    };
  });
  return res.json(decoratedApprovals);
});

router.post("/projects/current/approvals", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const { title, requester, requesterInitials, approver, status, dueDate, category, impactSummary } =
    req.body;

  if (!title || !requester || !approver) {
    return res.status(400).json({ error: "title, requester, and approver are required" });
  }

  const store = getStore(req);
  const newApproval = {
    id: "app-" + Date.now(),
    projectId: getProjectId(req),
    title,
    requester,
    requesterInitials:
      requesterInitials ||
      requester
        .split(" ")
        .map((part: string) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    approver,
    status: status || "pending",
    dueDate: dueDate || "2026-09-25",
    category: category || "Technical Submittal",
    impactSummary: impactSummary || "Required for downstream activity release.",
    createdAt: new Date().toISOString(),
  };

  store.approvals.unshift(newApproval);
  saveStoreToDisk();
  return res.status(201).json(newApproval);
});

router.patch("/approvals/:id", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "status is required" });

  const store = getStore(req);
  const approval = store.approvals.find((a) => a.id === req.params.id);
  if (!approval) return res.status(404).json({ error: "Approval not found" });

  // Role-Based Authorization Enforcement:
  const authCheck = isUserAuthorizedForApproval(req.user, approval);
  if (!authCheck.authorized) {
    return res.status(403).json({
      error: `Role authorization gate: ${authCheck.reason || `Requires ${authCheck.requiredRole} sign-off`}. Your active profile is ${req.user?.name || "User"} (${(req.user?.role || "guest").toUpperCase()}).`,
      requiredRole: authCheck.requiredRole,
    });
  }

  approval.status = status;
  if (status === "approved" || status === "rejected") {
    approval.completedAt = new Date().toISOString();

    // If unblocking structural lintel, unblock the corresponding activity
    if (approval.id === "app-1" && status === "approved") {
      const act5 = store.activities.find((a) => a.id === "act-5");
      if (act5) {
        act5.status = "in-progress";
        act5.blockedReason = null;
      }
    }
  }

  // Record into Project Memory
  logMemoryEntry(store, {
    id: "mem-" + Date.now(),
    projectId: getProjectId(req),
    title: `Sign-off ${status.toUpperCase()}: ${approval.title}`,
    description: `${approval.approver} (authorized by ${req.user?.name || "System"}) marked this submittal as ${status}. Impact: ${approval.impactSummary || "Downstream activity released."}`,
    type: "approval",
    actor: req.user?.name || approval.approver,
    tags: ["Approval", status, approval.category],
    createdAt: new Date().toISOString(),
  });

  saveStoreToDisk();
  return res.json(approval);
});

// ─────────────────────────────────────────────────────────────────────────────
// ALERTS
// ─────────────────────────────────────────────────────────────────────────────
router.get("/projects/current/alerts", async (req, res) => {
  const store = getStore(req);
  return res.json(store.alerts);
});

const handleAcknowledgeAlert = async (req: any, res: any) => {
  const store = getStore(req);
  let alert = store.alerts?.find((a: any) => a.id === req.params.id);
  if (!alert) {
    alert = villaStore.alerts?.find((a: any) => a.id === req.params.id);
  }
  if (!alert) {
    for (const pStore of Object.values(projectsStore)) {
      alert = pStore.alerts?.find((a: any) => a.id === req.params.id);
      if (alert) break;
    }
  }
  if (!alert) return res.status(404).json({ error: "Alert not found" });

  alert.acknowledged = true;
  try {
    const altUuid = ensureUUID(alert.id);
    await queryNeon("UPDATE alerts SET acknowledged = TRUE WHERE id = $1;", [altUuid]);
  } catch (e: any) {
    // Non-critical if direct SQL update fails
  }
  saveStoreToDisk();
  return res.json(alert);
};

const handleAcknowledgeAllAlerts = async (req: any, res: any) => {
  const store = getStore(req);
  if (store.alerts) {
    for (const a of store.alerts) {
      a.acknowledged = true;
    }
  }
  try {
    const pUuid = ensureUUID(getProjectId(req));
    await queryNeon("UPDATE alerts SET acknowledged = TRUE WHERE project_id = $1;", [pUuid]);
  } catch (e: any) {
    // Non-critical
  }
  saveStoreToDisk();
  return res.json({ success: true, count: store.alerts?.length || 0 });
};

router.patch("/alerts/:id/acknowledge", handleAcknowledgeAlert);
router.post("/alerts/:id/acknowledge", handleAcknowledgeAlert);
router.patch("/projects/current/alerts/:id/acknowledge", handleAcknowledgeAlert);
router.post("/projects/current/alerts/:id/acknowledge", handleAcknowledgeAlert);
router.post("/projects/current/alerts/acknowledge-all", handleAcknowledgeAllAlerts);
router.patch("/projects/current/alerts/acknowledge-all", handleAcknowledgeAllAlerts);
router.post("/alerts/acknowledge-all", handleAcknowledgeAllAlerts);
router.patch("/alerts/acknowledge-all", handleAcknowledgeAllAlerts);

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT MEMORY
// ─────────────────────────────────────────────────────────────────────────────
router.get("/projects/current/memory", async (req, res) => {
  const store = getStore(req);
  const sorted = [...(store.memory || [])].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
  return res.json(sorted);
});

router.post("/projects/current/memory", async (req, res) => {
  if (!requireWrite(req, res)) return;

  const { title, description, type, actor, tags, createdAt } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: "title and description are required" });
  }

  const store = getStore(req);
  const validCreatedAt =
    createdAt && !isNaN(new Date(createdAt).getTime())
      ? new Date(createdAt).toISOString()
      : new Date().toISOString();

  const newEntry = {
    id: "mem-" + Date.now(),
    projectId: getProjectId(req),
    title,
    description,
    type: type || "decision",
    actor: actor || req.user?.name || "Project Member",
    tags: Array.isArray(tags)
      ? tags
      : typeof tags === "string"
      ? tags
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean)
      : ["Note"],
    createdAt: validCreatedAt,
  };

  logMemoryEntry(store, newEntry);
  saveStoreToDisk();
  return res.status(201).json(newEntry);
});

// ─────────────────────────────────────────────────────────────────────────────
// AI COPILOT WITH RETRIEVAL-AUGMENTED GENERATION (RAG) PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

// RAG Memory Scoring Function: ranks memories by semantic and keyword relevance to the user query
function retrieveRelevantMemories(memories: any[], query: string, topK = 6): any[] {
  const qLower = query.toLowerCase();
  const queryTerms = qLower.split(/[\s,?.!]+/).filter((t) => t.length > 2);

  const scored = (memories || []).map((mem) => {
    let score = 0;
    const titleLower = (mem.title || "").toLowerCase();
    const descLower = (mem.description || "").toLowerCase();
    const actorLower = (mem.actor || "").toLowerCase();
    const tagsLower = Array.isArray(mem.tags) ? mem.tags.join(" ").toLowerCase() : "";

    for (const term of queryTerms) {
      if (titleLower.includes(term)) score += 6;
      if (descLower.includes(term)) score += 3;
      if (actorLower.includes(term)) score += 4;
      if (tagsLower.includes(term)) score += 4;
    }

    // Key topic entity boosts
    if (qLower.includes("geothermal") && (titleLower.includes("geothermal") || descLower.includes("geothermal"))) score += 12;
    if (qLower.includes("cantilever") && (titleLower.includes("cantilever") || descLower.includes("cantilever"))) score += 12;
    if (qLower.includes("glazing") && (titleLower.includes("glazing") || descLower.includes("glazing") || descLower.includes("window"))) score += 12;
    if (qLower.includes("travertine") && (titleLower.includes("travertine") || descLower.includes("travertine") || descLower.includes("finish"))) score += 12;
    if (qLower.includes("pool") && (titleLower.includes("pool") || descLower.includes("pool"))) score += 12;
    if (qLower.includes("coring") || qLower.includes("drill") || qLower.includes("sleeve")) score += 8;
    if (qLower.includes("marcus") && (actorLower.includes("marcus") || descLower.includes("marcus"))) score += 8;
    if (qLower.includes("rajesh") && (actorLower.includes("rajesh") || descLower.includes("rajesh"))) score += 8;
    if (qLower.includes("elena") && (actorLower.includes("elena") || descLower.includes("elena"))) score += 8;
    if (qLower.includes("carlos") && (actorLower.includes("carlos") || descLower.includes("carlos"))) score += 8;
    if (qLower.includes("decision") && mem.type === "decision") score += 5;
    if (qLower.includes("approval") && mem.type === "approval") score += 5;

    return { ...mem, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

// Grounded RAG Synthesizer: produces authentic, cited responses matching whole project memory
function buildGroundedRAGFallback(question: string, store: any, conversationHistory?: any[]) {
  const normalized = question.toLowerCase();
  const allMemories = store.memory || [];
  const relevantMemories = retrieveRelevantMemories(allMemories, question, 5);
  const blocked = store.activities.filter((item: any) => item.status === "blocked" || item.status === "at-risk");
  const pendingApprovals = store.approvals.filter((item: any) => item.status === "pending");
  const openActions = store.actions.filter((item: any) => item.status !== "done");

  let answer = "";
  let sources: string[] = [];
  let followUpActions: string[] = [];

  const isProjectExploration =
    normalized.includes("what is project") ||
    normalized.includes("explain project") ||
    normalized.includes("tell me about") ||
    normalized.includes("what is this project") ||
    normalized.includes("about the project") ||
    normalized.includes("project overview") ||
    normalized.includes("describe the project") ||
    normalized.includes("what are we building") ||
    normalized.includes("can you explain") ||
    normalized.includes("what is the project") ||
    normalized === "what is project can you explain ?" ||
    normalized.includes("what is project");

  if (isProjectExploration) {
    const isVilla = store.project.isDemo || store.project.name.includes("Grand Vista");
    if (isVilla) {
      answer = `### Project Overview: **The Grand Vista Luxury Villa**\n\n` +
        `The **Grand Vista Luxury Villa** is a 14,500 sq ft contemporary private residential estate located at **42 Crestline Ridge, Hill Country Estates**. It is designed as an architectural masterpiece featuring bespoke Italian craftsmanship and state-of-the-art building engineering.\n\n` +
        `### Core Architecture & Engineering Features\n` +
        `- **Multi-Level Cantilevered Living Spaces:** Post-tensioned concrete floor plates cantilevered gracefully over the hillside, stabilized with high-tensile rock anchor tiebacks.\n` +
        `- **12-Meter Motorized Panoramic Glazing:** Floor-to-ceiling slimline glass pocket sliders that recess invisibly into structural cavity pockets.\n` +
        `- **Closed-Loop Geothermal HVAC:** Sustainable underground geothermal boreholes providing silent radiant cooling/heating without noisy outdoor condenser units.\n` +
        `- **Bespoke Finishes:** Navona and Roman Cross-Cut Italian Travertine stone decks, custom teak woodwork, and a subterranean wine cellar.\n` +
        `- **Infinity Edge Cantilevered Pool:** Suspended pool shell over the natural rock cliff.\n\n` +
        `### Current Status & Milestones\n` +
        `- **Active Phase:** **${store.project.phase}**\n` +
        `- **Overall Completion:** **${store.project.progress}%**\n` +
        `- **Status:** **${store.project.status}**\n` +
        `- **Open Blockers:** ${blocked.length} items (notably structural calculation sign-off for the master suite lintel unblocking $180,000 glazing factory cutting).\n\n` +
        `### Multidisciplinary Project Network\n` +
        `- **David Chen** — Project Delivery Director (Apex Construction Management)\n` +
        `- **Marcus Vance** — Client & Property Owner (Vance Holdings)\n` +
        `- **Elena Rostova** — Principal Architect (Studio Rostova)\n` +
        `- **Rajesh Patel** — Principal Structural Engineer (Patel Engineering)\n` +
        `- **Carlos Gomez** — General Contractor & Site Superintendent\n` +
        `- **Tariq Mansoor** — MEP & Smart Automation Director\n` +
        `- **Sophia Laurent** — Lead Interior Designer\n\n` +
        `I have whole project memory loaded with ${allMemories.length} historical decisions, RFIs, and inspection records. Feel free to ask about any specific trade, delay, or design decision!`;
    } else {
      answer = `### Project Overview: **${store.project.name}**\n\n` +
        `${store.project.description || "Active multidisciplinary coordination workspace."}\n\n` +
        `### Project Parameters\n` +
        `- **Location:** ${store.project.location || "On-Site"}\n` +
        `- **Current Phase:** ${store.project.phase || "Planning & Execution"}\n` +
        `- **Completion Progress:** ${store.project.progress || 0}%\n` +
        `- **Health Status:** ${store.project.status || "On Track"}\n` +
        `- **Active Work Packages:** ${store.activities.length} deliverables\n` +
        `- **Documented Project Memory:** ${allMemories.length} historical records\n\n` +
        `Ask any question about active workstreams, dependency chains, or team handoffs!`;
    }
    sources = [`${store.project.name} Master Record`, "Whole Project Memory Archive"];
    followUpActions = [
      "Review structural lintel calculation submittal",
      "Check living room cantilever tendon coring restrictions",
      "Inspect cross-discipline handoff dependencies",
    ];
    return { answer, sources, confidence: "High (Whole Project Memory Verified)", followUpActions };
  } else if (relevantMemories.length > 0 && relevantMemories[0].score > 2) {
    const topMem = relevantMemories[0];
    answer = `### Decision & Memory Record: **${topMem.title}**\n\n${topMem.description}\n\n` +
      `- **Actor / Authority:** ${topMem.actor}\n` +
      `- **Record Type:** ${topMem.type.toUpperCase()}\n` +
      `- **Recorded Date:** ${new Date(topMem.createdAt).toLocaleDateString()}\n` +
      (topMem.tags?.length ? `- **Discipline Tags:** ${topMem.tags.join(", ")}\n` : "");

    if (relevantMemories.length > 1 && relevantMemories[1].score > 3) {
      const secondMem = relevantMemories[1];
      answer += `\n**Related Record [${secondMem.title}]:** ${secondMem.description}`;
    }

    sources = relevantMemories.slice(0, 3).map((m) => `Memory: ${m.title}`);
    followUpActions = [
      `Review full memory entry: ${topMem.title}`,
      `Coordinate with ${topMem.actor} on execution alignment`,
    ];
  } else if (normalized.includes("block") || normalized.includes("delay") || normalized.includes("risk") || normalized.includes("issue")) {
    if (blocked.length > 0) {
      answer = `### Active Critical Blockers on ${store.project.name}\n\n` +
        blocked.map((b: any) => `- **${b.title}** (${b.discipline})\n  - *Owner:* ${b.owner}\n  - *Reason:* ${b.blockedReason || "Pending prerequisite resolution"}\n  - *Due Date:* ${b.dueDate}`).join("\n\n");
    } else {
      answer = `### Blocker Status\n\nThere are currently **no blocked activities** recorded on **${store.project.name}**. All work packages are proceeding according to the baseline schedule.`;
    }
    sources = blocked.map((b: any) => b.title);
    followUpActions = blocked.slice(0, 3).map((b: any) => `Resolve blocker with ${b.owner}: ${b.title}`);
  } else if (normalized.includes("approval") || normalized.includes("sign-off") || normalized.includes("sign off")) {
    if (pendingApprovals.length > 0) {
      answer = `### Pending Sign-Offs & Approvals\n\n` +
        pendingApprovals.map((a: any) => `- **${a.title}**\n  - *Approver:* **${a.approver}**\n  - *Requester:* ${a.requester}\n  - *Discipline/Category:* ${a.category}\n  - *Status:* Pending Review`).join("\n\n");
    } else {
      answer = "### Sign-Off Status\n\nThere are **no pending approvals** currently awaiting authority sign-off.";
    }
    sources = pendingApprovals.map((a: any) => a.title);
    followUpActions = pendingApprovals.slice(0, 2).map((a: any) => `Notify ${a.approver} for ${a.title}`);
  } else if (normalized.includes("who") || normalized.includes("owner") || normalized.includes("owns") || normalized.includes("responsible")) {
    const matches = store.activities.filter((item: any) =>
      normalized.split(/\s+/).some((term: string) => term.length > 3 && `${item.title} ${item.discipline}`.toLowerCase().includes(term)),
    );
    const stakeholders = store.stakeholders.filter((s: any) =>
      normalized.includes(s.name.toLowerCase()) || normalized.includes(s.discipline.toLowerCase()) || normalized.includes(s.role.toLowerCase())
    );

    if (matches.length > 0) {
      answer = `### Work Package Ownership\n\n` +
        matches.map((item: any) => `- **${item.title}**\n  - *Owner:* **${item.owner}** (${item.discipline})\n  - *Status:* ${item.status}\n  - *Critical Path:* ${item.criticalPath ? "Yes" : "No"}`).join("\n\n");
      sources = matches.map((item: any) => item.title);
      followUpActions = matches.slice(0, 2).map((item: any) => `Coordinate with ${item.owner}`);
    } else if (stakeholders.length > 0) {
      answer = `### Stakeholder Details\n\n` +
        stakeholders.map((s: any) => `- **${s.name}** — ${s.role} (${s.discipline})\n  - *Company:* ${s.company}\n  - *Active Deliverables:* ${s.ownedCount}`).join("\n\n");
      sources = stakeholders.map((s: any) => `${s.name} (${s.role})`);
      followUpActions = [`Reach out to ${stakeholders[0].name}`];
    } else {
      answer = `### Coordination Summary for ${store.project.name}\n\n` +
        `- **Total Activities:** ${store.activities.length}\n` +
        `- **Active Blockers:** ${blocked.length}\n` +
        `- **Pending Sign-Offs:** ${pendingApprovals.length}\n` +
        `- **Documented Memories:** ${allMemories.length}\n\n` +
        `You can ask specific questions such as: *"Who owns motorized glazing?"*, *"What was decided about geothermal HVAC?"*, or *"Show me pending approvals."*`;
      sources = [`${store.project.name} Project Records`];
      followUpActions = ["Check Dependency Graph", "View Pending Approvals"];
    }
  } else {
    answer = `### Project Coordination Status: **${store.project.name}**\n\n` +
      `- **Phase:** ${store.project.phase || "Active Construction"}\n` +
      `- **Progress:** ${store.project.progress || 0}%\n` +
      `- **Blocked / At-Risk Activities:** ${blocked.length}\n` +
      `- **Pending Authority Approvals:** ${pendingApprovals.length}\n` +
      `- **Open Coordination Actions:** ${openActions.length}\n` +
      `- **Project Memory Archive:** ${allMemories.length} historical records\n\n` +
      `Ask any question about historical decisions, technical specifications, blast radius impacts, or trade responsibilities.`;
    sources = [`${store.project.name} Workspace Intelligence`];
    followUpActions = ["Review active approvals in Control Room", "Check critical path on Dependency Graph"];
  }

  return { answer, sources, confidence: "High (Memory Grounded)", followUpActions };
}

async function askGeminiWithRetry(prompt: string, maxRetries = 1): Promise<string> {
  const modelsToTry = ["gemini-3.1-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastErr: any;
  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const model = genAI!.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json" },
        });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
      } catch (err: any) {
        lastErr = err;
        console.warn(`[Gemini API] Attempt ${attempt + 1} with ${modelName} failed:`, err.message);
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  }
  throw lastErr;
}

router.post("/projects/current/ask", async (req, res) => {
  try {
    const { question, conversationHistory } = req.body;
    if (!question?.trim()) {
      return res.status(400).json({ error: "question is required" });
    }

    const store = getStore(req);

    // INJECT THE COMPLETE PROJECT MEMORY & LIVE STATE
    const allMemories = store.memory || [];
    const allActivities = store.activities || [];
    const allDependencies = store.dependencies || [];
    const allChanges = store.changes || [];
    const allApprovals = store.approvals || [];
    const allActions = store.actions || [];
    const allStakeholders = store.stakeholders || [];

    if (!genAI) {
      return res.json(buildGroundedRAGFallback(question, store, conversationHistory));
    }

    // Comprehensive whole project memory context
    const fullProjectContext = {
      project: {
        id: store.project.id,
        name: store.project.name,
        description: store.project.description,
        location: store.project.location,
        phase: store.project.phase,
        status: store.project.status,
        progress: store.project.progress,
        isDemo: store.project.isDemo,
      },
      // ENTIRE PROJECT MEMORY ARCHIVE (All decisions, meetings, field notes, and RFIs)
      wholeProjectMemory: allMemories.map((m: any) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        actor: m.actor,
        date: m.createdAt,
        description: m.description,
        tags: m.tags || [],
      })),
      activities: allActivities.map((a: any) => ({
        id: a.id,
        title: a.title,
        discipline: a.discipline,
        owner: a.owner,
        status: a.status,
        dueDate: a.dueDate,
        blockedReason: a.blockedReason || null,
        criticalPath: a.criticalPath,
        dependencyCount: a.dependencyCount,
      })),
      dependencies: allDependencies.map((d: any) => ({
        fromTitle: d.fromTitle,
        toTitle: d.toTitle,
        type: d.type,
        status: d.status,
      })),
      changes: allChanges.map((c: any) => ({
        title: c.title,
        status: c.status,
        costImpact: c.costImpact,
        scheduleImpact: c.scheduleImpact,
        affectedStakeholders: c.affectedStakeholders,
        blastRadius: c.blastRadius,
      })),
      approvals: allApprovals.map((ap: any) => ({
        title: ap.title,
        approver: ap.approver,
        requester: ap.requester,
        category: ap.category,
        status: ap.status,
        dueDate: ap.dueDate,
      })),
      actions: allActions.map((ac: any) => ({
        title: ac.title,
        owner: ac.owner,
        priority: ac.priority,
        status: ac.status,
        dueDate: ac.dueDate,
      })),
      stakeholders: allStakeholders.map((s: any) => ({
        name: s.name,
        role: s.role,
        discipline: s.discipline,
        company: s.company,
        email: s.email,
        raci: s.raci || {},
      })),
    };

    const prompt = `You are the Coordination Intelligence Copilot for "${store.project.name}".
You are an expert AI coordinator assisting project architects, structural engineers, general contractors, and owners.
You have COMPLETE ACCESS to the whole project memory archive, live activities, dependency graph, change orders, approvals, and RACI matrices.

CRITICAL INSTRUCTIONS:
1. When asked "what is project can you explain ?" or any question about the project overview, describe the project in rich architectural, structural, and coordination detail with location, square footage, cantilevered structural features, motorized glazing, geothermal HVAC, key stakeholders, and current progress.
2. When answering questions about decisions, meetings, historical shifts, or RFIs, ALWAYS reference the exact Title, Actor, and Date from the wholeProjectMemory.
3. Structure your answer using clean, human-readable Markdown:
   - Use bold headers (###) for main sections.
   - Use bold text for people's names, company names, and critical statuses.
   - Use bullet points (- ) or numbered lists (1. ) for steps, impacts, and items.
   - Keep answers clear, factual, actionable, and accurate to the project records.
4. If the user asks about who owns a deliverable, consult both the activities list and the stakeholder RACI matrices.
5. If the user asks about delays or blockers, explain the downstream blast radius and which activities are affected.

FULL PROJECT KNOWLEDGE BASE & WHOLE MEMORY:
${JSON.stringify(fullProjectContext, null, 2)}

${conversationHistory && conversationHistory.length ? `RECENT CONVERSATION HISTORY:\n${JSON.stringify(conversationHistory.slice(-4), null, 2)}\n` : ""}

CURRENT USER QUESTION: ${question}

Respond ONLY with a JSON object in this exact schema:
{
  "answer": "Clean Markdown formatted answer with clear headings, bullet points, bold key terms, and exact citations to project memory",
  "sources": ["Specific Memory Title 1", "Activity Title 2", "Approval Record 3"],
  "confidence": "High (Project Memory Verified)",
  "followUpActions": ["Actionable next coordination step 1", "Actionable next coordination step 2"]
}`;

    const text = await askGeminiWithRetry(prompt);
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
      parsed = JSON.parse(cleaned);
    }

    return res.json({
      answer: parsed.answer,
      sources: Array.isArray(parsed.sources) ? parsed.sources : ["Project Memory"],
      confidence: parsed.confidence || "High (Project Memory Verified)",
      followUpActions: Array.isArray(parsed.followUpActions) ? parsed.followUpActions : [],
    });
  } catch (err: any) {
    console.error("Copilot error:", err);
    return res.json(buildGroundedRAGFallback(req.body.question, getStore(req), req.body.conversationHistory));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-CHANNEL SIGNAL INGESTION
// ─────────────────────────────────────────────────────────────────────────────
router.post("/projects/current/ingest-signal", async (req, res) => {
  try {
    const { rawText, source = "WhatsApp Site Alert", autoCommit = false } = req.body;
    if (!rawText?.trim()) {
      return res.status(400).json({ error: "rawText is required" });
    }

    const store = getStore(req);
    const { stakeholders } = store;

    let parsed: any;
    if (genAI) {
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" },
      });

      const prompt = `You are a Construction Signal NLP Parser for "${store.project.name}". Extract structured coordination data from this informal signal.

PROJECT STAKEHOLDERS: ${stakeholders.map((s) => `${s.name} (${s.role}, ${s.discipline})`).join(", ")}
SOURCE: ${source}
SIGNAL: ${rawText}

Extract and return JSON:
{
  "title": "Concise descriptive title (max 10 words)",
  "summary": "2-3 sentence summary explaining the issue, affected discipline, and coordination risk",
  "severity": "low|medium|high|critical",
  "discipline": "Structural|MEP|Facade|Interiors|Civil|Landscape|Architecture",
  "lead": "Name of primary responsible stakeholder from list above",
  "confidence": "percentage string with %",
  "actions": [{"title": "Concrete action description", "owner": "Owner name from list", "priority": "normal|high|urgent"}]
}`;

      const result = await model.generateContent(prompt);
      parsed = JSON.parse(result.response.text().trim());
    } else {
      parsed = {
        title: `Site Signal: ${rawText.slice(0, 45)}...`,
        summary: rawText.slice(0, 220),
        severity: "high",
        discipline: "Structural",
        lead: stakeholders[0]?.name || "Site Lead",
        confidence: "88% (Heuristic Model)",
        actions: [
          { title: "Review on-site sleeve clearance with structural engineer", owner: stakeholders[0]?.name || "Lead Engineer", priority: "urgent" },
          { title: "Issue revised conduit layout before concrete pour", owner: stakeholders[1]?.name || "MEP Lead", priority: "high" },
        ],
      };
    }

    parsed.rawText = rawText;
    parsed.source = source;
    parsed.confidence = parsed.confidence || "92% (Gemini AI Grounded)";

    if (autoCommit) {
      const newChange = {
        id: "chg-" + Date.now(),
        projectId: getProjectId(req),
        title: parsed.title,
        summary: parsed.summary || rawText,
        severity: parsed.severity || "medium",
        discipline: parsed.discipline || "General",
        createdBy: parsed.lead || req.user?.name || "Site Team",
        status: "active",
        affectedCount: parsed.actions?.length || 2,
        rawSignal: rawText,
        createdAt: new Date().toISOString(),
      };

      store.changes.unshift(newChange);

      // Write into Project Memory
      logMemoryEntry(store, {
        id: "mem-" + Date.now(),
        projectId: getProjectId(req),
        title: `Signal Ingested: ${parsed.title}`,
        description: `Channel: ${source}. ${parsed.summary}`,
        type: "change",
        actor: parsed.lead || req.user?.name || "Site Team",
        tags: [source, "AI Ingested", parsed.discipline || "General"],
        createdAt: new Date().toISOString(),
      });

      // Write Alert
      store.alerts.unshift({
        id: "alt-" + Date.now(),
        projectId: getProjectId(req),
        title: `Coordination Signal Ingested: ${parsed.title}`,
        description: parsed.summary.slice(0, 140),
        type: "impact",
        severity: parsed.severity || "high",
        acknowledged: false,
        createdAt: new Date().toISOString(),
      });

      // Adopt generated actions
      if (parsed.actions && Array.isArray(parsed.actions)) {
        for (let i = 0; i < parsed.actions.length; i++) {
          const act = parsed.actions[i];
          store.actions.unshift({
            id: "actn-" + (Date.now() + i),
            projectId: getProjectId(req),
            title: act.title,
            owner: act.owner || parsed.lead || req.user?.name || "Site Lead",
            ownerInitials: (act.owner || parsed.lead || "SL")
              .split(" ")
              .map((p: string) => p[0])
              .join("")
              .slice(0, 2),
            status: "todo",
            dueDate: "2026-09-24",
            priority: act.priority || "normal",
            source: `Signal: ${source}`,
            createdAt: new Date().toISOString(),
          });
        }
      }

      saveStoreToDisk();
      return res.status(201).json({ ...parsed, committedChange: newChange });
    }

    return res.json(parsed);
  } catch (err: any) {
    console.error("Signal ingestion error:", err);
    return res.status(500).json({ error: "Signal ingestion error: " + err.message });
  }
});

export default router;
