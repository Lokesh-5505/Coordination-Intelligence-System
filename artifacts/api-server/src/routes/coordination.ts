import { Router, type IRouter } from "express";
import {
  AcknowledgeAlertParams,
  AskProjectBody,
  CreateChangeBody,
  GetChangeImpactParams,
  UpdateActionBody,
  UpdateActionParams,
  UpdateApprovalBody,
  UpdateApprovalParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const project = {
  id: "riverside",
  name: "Riverside Mixed-Use Development",
  location: "Pune, Maharashtra",
  status: "On track",
  progress: 68,
  phase: "Structure & envelope",
  updatedAt: "Today, 09:42",
};

const stakeholders = [
  { id: "maya", name: "Maya Shah", initials: "MS", role: "Project Manager", company: "Riverside PMC", status: "online", ownedCount: 14, affectedByCount: 7 },
  { id: "arjun", name: "Arjun Mehta", initials: "AM", role: "Lead Architect", company: "Studio North", status: "online", ownedCount: 9, affectedByCount: 4 },
  { id: "neha", name: "Neha Iyer", initials: "NI", role: "Structural Consultant", company: "Axis Structures", status: "offline", ownedCount: 6, affectedByCount: 3 },
  { id: "rohan", name: "Rohan Kulkarni", initials: "RK", role: "Main Contractor", company: "BuildRight Infra", status: "online", ownedCount: 11, affectedByCount: 5 },
  { id: "sana", name: "Sana Kapoor", initials: "SK", role: "MEP Consultant", company: "Vector MEP", status: "online", ownedCount: 8, affectedByCount: 6 },
  { id: "vikram", name: "Vikram Rao", initials: "VR", role: "Facade Vendor", company: "Glassline Systems", status: "offline", ownedCount: 5, affectedByCount: 2 },
  { id: "priya", name: "Priya Menon", initials: "PM", role: "Client Representative", company: "Riverside Holdings", status: "online", ownedCount: 4, affectedByCount: 8 },
  { id: "daniel", name: "Daniel D'Souza", initials: "DD", role: "Site Engineer", company: "BuildRight Infra", status: "online", ownedCount: 12, affectedByCount: 3 },
];

const activities = [
  { id: "a-101", title: "Tower B slab level revision", type: "Change", owner: "Neha Iyer", ownerInitials: "NI", status: "blocked", dueDate: "Sep 18", dependencyCount: 6, blockedReason: "Awaiting structural sign-off" },
  { id: "a-102", title: "MEP sleeve coordination — Level 12", type: "Deliverable", owner: "Sana Kapoor", ownerInitials: "SK", status: "in-progress", dueDate: "Sep 16", dependencyCount: 3, blockedReason: null },
  { id: "a-103", title: "Facade shop drawings — Tower B", type: "Approval", owner: "Vikram Rao", ownerInitials: "VR", status: "at-risk", dueDate: "Sep 19", dependencyCount: 4, blockedReason: null },
  { id: "a-104", title: "Retail podium fire strategy", type: "Approval", owner: "Arjun Mehta", ownerInitials: "AM", status: "pending", dueDate: "Sep 20", dependencyCount: 2, blockedReason: null },
  { id: "a-105", title: "Basement waterproofing inspection", type: "Inspection", owner: "Daniel D'Souza", ownerInitials: "DD", status: "complete", dueDate: "Sep 12", dependencyCount: 0, blockedReason: null },
  { id: "a-106", title: "Electrical riser coordination", type: "Deliverable", owner: "Sana Kapoor", ownerInitials: "SK", status: "in-progress", dueDate: "Sep 22", dependencyCount: 5, blockedReason: null },
  { id: "a-107", title: "Joinery package release", type: "Procurement", owner: "Rohan Kulkarni", ownerInitials: "RK", status: "pending", dueDate: "Sep 25", dependencyCount: 2, blockedReason: null },
  { id: "a-108", title: "Tower A typical floor mock-up", type: "Milestone", owner: "Maya Shah", ownerInitials: "MS", status: "complete", dueDate: "Sep 11", dependencyCount: 1, blockedReason: null },
];

const dependencies = [
  { id: "d-1", fromId: "a-101", fromTitle: "Tower B slab level revision", toId: "a-102", toTitle: "MEP sleeve coordination — Level 12", type: "blocks", status: "active" },
  { id: "d-2", fromId: "a-101", fromTitle: "Tower B slab level revision", toId: "a-103", toTitle: "Facade shop drawings — Tower B", type: "changes", status: "active" },
  { id: "d-3", fromId: "a-102", fromTitle: "MEP sleeve coordination — Level 12", toId: "a-106", toTitle: "Electrical riser coordination", type: "precedes", status: "active" },
  { id: "d-4", fromId: "a-104", fromTitle: "Retail podium fire strategy", toId: "a-107", toTitle: "Joinery package release", type: "requires", status: "active" },
  { id: "d-5", fromId: "a-105", fromTitle: "Basement waterproofing inspection", toId: "a-108", toTitle: "Tower A typical floor mock-up", type: "informs", status: "complete" },
  { id: "d-6", fromId: "a-101", fromTitle: "Tower B slab level revision", toId: "a-104", toTitle: "Retail podium fire strategy", type: "reviews", status: "active" },
];

let changes = [
  { id: "c-001", title: "Tower B slab level revision", summary: "Structural consultant raised the Level 12 slab by 150mm to clear the revised transfer beam.", status: "active", severity: "high", createdBy: "Neha Iyer", createdAt: "Today, 08:55", affectedCount: 8 },
  { id: "c-002", title: "Retail frontage material substitution", summary: "Client approved a switch from bronze anodized aluminium to powder-coated champagne finish.", status: "resolved", severity: "medium", createdBy: "Priya Menon", createdAt: "Sep 11, 14:20", affectedCount: 4 },
  { id: "c-003", title: "Basement ramp drainage detail", summary: "Site team requested a revised drain channel detail after the first waterproofing inspection.", status: "monitoring", severity: "medium", createdBy: "Daniel D'Souza", createdAt: "Sep 09, 11:10", affectedCount: 3 },
];

const approvals = [
  { id: "ap-1", title: "Tower B revised structural drawings", requester: "Neha Iyer", requesterInitials: "NI", approver: "Maya Shah", status: "pending", dueDate: "Today", category: "Structural" },
  { id: "ap-2", title: "Facade mullion profile — Tower B", requester: "Vikram Rao", requesterInitials: "VR", approver: "Arjun Mehta", status: "pending", dueDate: "Sep 17", category: "Facade" },
  { id: "ap-3", title: "Retail fire strategy revision", requester: "Arjun Mehta", requesterInitials: "AM", approver: "Priya Menon", status: "changes-requested", dueDate: "Sep 19", category: "Life safety" },
  { id: "ap-4", title: "Basement waterproofing sign-off", requester: "Daniel D'Souza", requesterInitials: "DD", approver: "Maya Shah", status: "approved", dueDate: "Sep 12", category: "Inspection" },
];

const actions = [
  { id: "ac-1", title: "Issue revised Level 12 coordination drawing", owner: "Arjun Mehta", ownerInitials: "AM", status: "in-progress", dueDate: "Today", source: "Tower B slab revision", priority: "urgent" },
  { id: "ac-2", title: "Recalculate MEP sleeve offsets", owner: "Sana Kapoor", ownerInitials: "SK", status: "todo", dueDate: "Sep 16", source: "Tower B slab revision", priority: "high" },
  { id: "ac-3", title: "Confirm revised pour sequence with site team", owner: "Rohan Kulkarni", ownerInitials: "RK", status: "todo", dueDate: "Sep 17", source: "Tower B slab revision", priority: "high" },
  { id: "ac-4", title: "Upload coordinated facade shop drawings", owner: "Vikram Rao", ownerInitials: "VR", status: "blocked", dueDate: "Sep 19", source: "Tower B slab revision", priority: "high" },
  { id: "ac-5", title: "Close podium drainage RFI", owner: "Daniel D'Souza", ownerInitials: "DD", status: "done", dueDate: "Sep 12", source: "Basement drainage detail", priority: "normal" },
];

const alerts = [
  { id: "al-1", title: "Tower B revision affects your work", description: "The slab level change touches 6 activities and requires your review.", type: "impact", createdAt: "8 min ago", acknowledged: false, severity: "high" },
  { id: "al-2", title: "Approval due today", description: "Revised structural drawings are waiting for Maya Shah's decision.", type: "approval", createdAt: "42 min ago", acknowledged: false, severity: "medium" },
  { id: "al-3", title: "Facade drawings at risk", description: "The shop drawing milestone depends on the Tower B revision.", type: "delay", createdAt: "Yesterday", acknowledged: false, severity: "medium" },
  { id: "al-4", title: "Waterproofing inspection closed", description: "Basement waterproofing was signed off by the project manager.", type: "resolution", createdAt: "Sep 12", acknowledged: true, severity: "low" },
];

const memory = [
  { id: "m-1", title: "Tower B slab level revision logged", description: "A 150mm level adjustment was recorded with 8 potential downstream impacts.", type: "change", actor: "Neha Iyer", createdAt: "Today, 08:55" },
  { id: "m-2", title: "Structural review requested", description: "Revised drawings were routed to the project manager for approval.", type: "approval", actor: "System", createdAt: "Today, 09:02" },
  { id: "m-3", title: "MEP coordination action created", description: "Sana Kapoor was assigned to recalculate sleeve offsets by Sep 16.", type: "action", actor: "Maya Shah", createdAt: "Today, 09:12" },
  { id: "m-4", title: "Basement waterproofing resolved", description: "Inspection notes and photo evidence were accepted by the PMC.", type: "resolution", actor: "Maya Shah", createdAt: "Sep 12, 16:40" },
  { id: "m-5", title: "Facade package issued for review", description: "Glassline Systems uploaded the latest Tower B shop drawing set.", type: "deliverable", actor: "Vikram Rao", createdAt: "Sep 10, 12:18" },
];

const briefing = {
  greeting: "Good morning, Maya",
  summary: "Tower B is the only active coordination risk today. The slab revision is contained, but five downstream actions need owners to keep the facade and MEP packages on schedule.",
  items: [
    "Review revised structural drawings before the 4:00 PM coordination call.",
    "Follow up with Glassline Systems on the facade shop drawing dependency.",
    "Confirm that the MEP sleeve recalculation is started by Sana Kapoor.",
  ],
  generatedAt: "Generated 9 minutes ago",
};

function makeImpact(changeId: string) {
  return {
    changeId,
    headline: "This revision touches 8 records across 5 stakeholders",
    explanation: "The dependency graph traces the revised slab level into MEP sleeves, facade shop drawings, fire strategy review and the next pour sequence. The primary risk is a cascading two-day delay if the structural approval is not closed today.",
    scheduleImpact: "Up to 2 working days on Tower B envelope coordination",
    severity: "high",
    items: [
      { id: "i-1", label: "MEP sleeve coordination — Level 12", kind: "activity", owner: "Sana Kapoor", ownerInitials: "SK", severity: "high", reason: "Sleeve offsets reference the previous slab datum.", dueDate: "Sep 16" },
      { id: "i-2", label: "Facade shop drawings — Tower B", kind: "deliverable", owner: "Vikram Rao", ownerInitials: "VR", severity: "high", reason: "Mullion and bracket heights must be re-coordinated.", dueDate: "Sep 19" },
      { id: "i-3", label: "Revised structural drawings", kind: "approval", owner: "Maya Shah", ownerInitials: "MS", severity: "urgent", reason: "The new datum cannot be issued without PMC approval.", dueDate: "Today" },
      { id: "i-4", label: "Tower B pour sequence", kind: "action", owner: "Rohan Kulkarni", ownerInitials: "RK", severity: "medium", reason: "Site sequencing needs confirmation before the next pour.", dueDate: "Sep 17" },
    ],
    draftActions: [
      { id: "da-1", title: "Recalculate MEP sleeve offsets", owner: "Sana Kapoor", ownerInitials: "SK", dueDate: "Sep 16", priority: "high" },
      { id: "da-2", title: "Issue coordinated Level 12 drawing", owner: "Arjun Mehta", ownerInitials: "AM", dueDate: "Today", priority: "urgent" },
      { id: "da-3", title: "Confirm revised pour sequence", owner: "Rohan Kulkarni", ownerInitials: "RK", dueDate: "Sep 17", priority: "high" },
    ],
    approvals: ["Revised structural drawings — Maya Shah", "Updated facade shop drawings — Arjun Mehta"],
  };
}

router.get("/projects/current/overview", (_req, res) => {
  res.json({
    project,
    stats: { blocked: activities.filter((item) => item.status === "blocked").length, overdue: 3, approvals: approvals.filter((item) => item.status === "pending").length, alerts: alerts.filter((item) => !item.acknowledged).length },
    briefing,
    recentActivity: [
      { id: "e-1", label: "Change logged", description: "Tower B slab level revision", actor: "Neha Iyer", actorInitials: "NI", createdAt: "8 min ago", tone: "warning" },
      { id: "e-2", label: "Approval requested", description: "Revised structural drawings", actor: "System", actorInitials: "CI", createdAt: "15 min ago", tone: "blue" },
      { id: "e-3", label: "Action assigned", description: "MEP sleeve recalculation", actor: "Maya Shah", actorInitials: "MS", createdAt: "27 min ago", tone: "green" },
      { id: "e-4", label: "Issue resolved", description: "Basement waterproofing inspection", actor: "Maya Shah", actorInitials: "MS", createdAt: "Yesterday", tone: "green" },
    ],
  });
});

router.get("/projects/current/stakeholders", (_req, res) => res.json(stakeholders));
router.get("/projects/current/activities", (_req, res) => res.json(activities));
router.get("/projects/current/dependencies", (_req, res) => res.json(dependencies));
router.get("/projects/current/changes", (_req, res) => res.json(changes));
router.get("/projects/current/approvals", (_req, res) => res.json(approvals));
router.get("/projects/current/actions", (_req, res) => res.json(actions));
router.get("/projects/current/alerts", (_req, res) => res.json(alerts));
router.get("/projects/current/memory", (_req, res) => res.json(memory));
router.get("/projects/current/briefing", (_req, res) => res.json(briefing));

router.post("/projects/current/changes", (req, res) => {
  const parsed = CreateChangeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid change", details: parsed.error.flatten() });
  const created = { id: `c-${Date.now()}`, ...parsed.data, status: "active", createdBy: "Maya Shah", createdAt: "Just now", affectedCount: 0 };
  changes = [created, ...changes];
  return res.status(201).json(created);
});

router.get("/changes/:changeId/impact", (req, res) => {
  const parsed = GetChangeImpactParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid change id" });
  return res.json(makeImpact(parsed.data.changeId));
});

router.post("/changes/:changeId/analyze-impact", (req, res) => {
  const parsed = GetChangeImpactParams.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: "Invalid change id" });
  return res.json(makeImpact(parsed.data.changeId));
});

router.patch("/approvals/:approvalId", (req, res) => {
  const params = UpdateApprovalParams.safeParse(req.params);
  const body = UpdateApprovalBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid approval update" });
  const item = approvals.find((approval) => approval.id === params.data.approvalId);
  if (!item) return res.status(404).json({ error: "Approval not found" });
  item.status = body.data.status;
  return res.json(item);
});

router.patch("/actions/:actionId", (req, res) => {
  const params = UpdateActionParams.safeParse(req.params);
  const body = UpdateActionBody.safeParse(req.body);
  if (!params.success || !body.success) return res.status(400).json({ error: "Invalid action update" });
  const item = actions.find((action) => action.id === params.data.actionId);
  if (!item) return res.status(404).json({ error: "Action not found" });
  item.status = body.data.status;
  return res.json(item);
});

router.post("/alerts/:alertId/acknowledge", (req, res) => {
  const params = AcknowledgeAlertParams.safeParse(req.params);
  if (!params.success) return res.status(400).json({ error: "Invalid alert id" });
  const item = alerts.find((alert) => alert.id === params.data.alertId);
  if (!item) return res.status(404).json({ error: "Alert not found" });
  item.acknowledged = true;
  return res.json(item);
});

router.post("/projects/current/ask", (req, res) => {
  const parsed = AskProjectBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ask a project question" });
  const question = parsed.data.question.toLowerCase();
  if (question.includes("glazing") || question.includes("facade")) {
    return res.json({ answer: "Glazing is currently at risk because Tower B facade shop drawings depend on the revised slab datum. Vikram Rao owns the package, due Sep 19, and it is waiting on Arjun Mehta's review.", confidence: "High", sources: ["Facade shop drawings — Tower B", "Tower B slab level revision", "Arjun Mehta"] });
  }
  if (question.includes("mep") || question.includes("sleeve")) {
    return res.json({ answer: "Sana Kapoor owns the MEP sleeve coordination for Level 12. It is in progress, due Sep 16, and blocked from final issue until the slab datum is approved.", confidence: "High", sources: ["MEP sleeve coordination — Level 12", "Tower B slab level revision"] });
  }
  if (question.includes("approval") || question.includes("approve")) {
    return res.json({ answer: "You have two pending approvals: revised structural drawings due today and the facade mullion profile due Sep 17. The structural approval is the higher-risk decision because it unblocks the MEP and facade chains.", confidence: "High", sources: ["Revised structural drawings", "Facade mullion profile — Tower B", "Tower B slab level revision"] });
  }
  return res.json({ answer: "The project has one high-severity coordination risk: the Tower B slab revision. It touches MEP, facade, structural approval and the next pour sequence. Start with the revised structural drawing approval.", confidence: "Medium", sources: ["Project overview", "Tower B slab level revision", "Impact report"] });
});

export default router;