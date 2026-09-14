import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────
export const activityStatusEnum = pgEnum("activity_status", [
  "blocked",
  "in-progress",
  "at-risk",
  "pending",
  "complete",
]);
export const changeSeverityEnum = pgEnum("change_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const changeStatusEnum = pgEnum("change_status", [
  "active",
  "resolved",
  "monitoring",
]);
export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);
export const actionStatusEnum = pgEnum("action_status", [
  "todo",
  "in-progress",
  "done",
]);
export const actionPriorityEnum = pgEnum("action_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);
export const stakeholderStatusEnum = pgEnum("stakeholder_status", [
  "online",
  "on-site",
  "in-meeting",
  "offline",
]);
export const memoryTypeEnum = pgEnum("memory_type", [
  "decision",
  "change",
  "action",
  "approval",
  "milestone",
  "issue",
]);
export const alertTypeEnum = pgEnum("alert_type", [
  "impact",
  "deadline",
  "approval",
  "info",
]);
export const alertSeverityEnum = pgEnum("alert_severity", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const dependencyTypeEnum = pgEnum("dependency_type", [
  "blocks",
  "depends-on",
  "relates-to",
]);
export const dependencyStatusEnum = pgEnum("dependency_status", [
  "active",
  "resolved",
]);
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "member",
  "viewer",
]);

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("admin"),
    projectId: uuid("project_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("users_email_idx").on(table.email),
    index("users_project_id_idx").on(table.projectId),
  ],
);

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projectsTable = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    location: text("location"),
    phase: text("phase").notNull().default("Planning"),
    status: text("status").notNull().default("On track"),
    progress: integer("progress").notNull().default(0),
    ownerId: uuid("owner_id").notNull(),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("projects_owner_id_idx").on(table.ownerId)],
);

// ─── Stakeholders ─────────────────────────────────────────────────────────────
export const stakeholdersTable = pgTable(
  "stakeholders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    name: text("name").notNull(),
    initials: text("initials").notNull(),
    role: text("role").notNull(),
    discipline: text("discipline").notNull(),
    company: text("company").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    status: stakeholderStatusEnum("status").notNull().default("online"),
    ownedCount: integer("owned_count").notNull().default(0),
    affectedByCount: integer("affected_by_count").notNull().default(0),
    raci: text("raci"), // JSON string: { packageKey: "R"|"A"|"C"|"I" }
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("stakeholders_project_id_idx").on(table.projectId)],
);

// ─── Activities ───────────────────────────────────────────────────────────────
export const activitiesTable = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull().default("Deliverable"),
    discipline: text("discipline").notNull().default("Architecture"),
    owner: text("owner").notNull(),
    ownerInitials: text("owner_initials").notNull(),
    status: activityStatusEnum("status").notNull().default("in-progress"),
    dueDate: text("due_date"),
    location: text("location"),
    criticalPath: boolean("critical_path").notNull().default(false),
    dependencyCount: integer("dependency_count").notNull().default(0),
    blockedReason: text("blocked_reason"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("activities_project_id_idx").on(table.projectId),
    index("activities_status_idx").on(table.status),
  ],
);

// ─── Dependencies ─────────────────────────────────────────────────────────────
export const dependenciesTable = pgTable(
  "dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    fromId: uuid("from_id").notNull(),
    fromTitle: text("from_title").notNull(),
    toId: uuid("to_id").notNull(),
    toTitle: text("to_title").notNull(),
    type: dependencyTypeEnum("type").notNull().default("blocks"),
    status: dependencyStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("dependencies_project_id_idx").on(table.projectId),
    index("dependencies_from_id_idx").on(table.fromId),
    index("dependencies_to_id_idx").on(table.toId),
  ],
);

// ─── Changes ──────────────────────────────────────────────────────────────────
export const changesTable = pgTable(
  "changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    status: changeStatusEnum("status").notNull().default("active"),
    severity: changeSeverityEnum("severity").notNull().default("medium"),
    createdBy: text("created_by").notNull(),
    discipline: text("discipline"),
    affectedCount: integer("affected_count").notNull().default(0),
    rawSignal: text("raw_signal"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("changes_project_id_idx").on(table.projectId)],
);

// ─── Actions ──────────────────────────────────────────────────────────────────
export const actionsTable = pgTable(
  "actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    title: text("title").notNull(),
    owner: text("owner").notNull(),
    ownerInitials: text("owner_initials").notNull(),
    status: actionStatusEnum("status").notNull().default("todo"),
    dueDate: text("due_date"),
    source: text("source"),
    priority: actionPriorityEnum("priority").notNull().default("normal"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("actions_project_id_idx").on(table.projectId),
    index("actions_owner_idx").on(table.owner),
  ],
);

// ─── Approvals ────────────────────────────────────────────────────────────────
export const approvalsTable = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    title: text("title").notNull(),
    requester: text("requester").notNull(),
    requesterInitials: text("requester_initials").notNull(),
    approver: text("approver").notNull(),
    status: approvalStatusEnum("status").notNull().default("pending"),
    dueDate: text("due_date"),
    category: text("category").notNull().default("Technical Submittal"),
    impactSummary: text("impact_summary"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("approvals_project_id_idx").on(table.projectId),
    index("approvals_status_idx").on(table.status),
  ],
);

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertsTable = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    type: alertTypeEnum("type").notNull().default("info"),
    severity: alertSeverityEnum("severity").notNull().default("medium"),
    acknowledged: boolean("acknowledged").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("alerts_project_id_idx").on(table.projectId)],
);

// ─── Memory ───────────────────────────────────────────────────────────────────
export const memoryTable = pgTable(
  "memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    type: memoryTypeEnum("type").notNull().default("decision"),
    actor: text("actor").notNull(),
    tags: text("tags"), // JSON string: string[]
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("memory_project_id_idx").on(table.projectId),
    index("memory_type_idx").on(table.type),
  ],
);

// ─── Insert Schemas (Zod) ─────────────────────────────────────────────────────
export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertStakeholderSchema = createInsertSchema(
  stakeholdersTable,
).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activitiesTable).omit({
  id: true,
  createdAt: true,
});
export const insertDependencySchema = createInsertSchema(
  dependenciesTable,
).omit({ id: true, createdAt: true });
export const insertChangeSchema = createInsertSchema(changesTable).omit({
  id: true,
  createdAt: true,
});
export const insertActionSchema = createInsertSchema(actionsTable).omit({
  id: true,
  createdAt: true,
});
export const insertApprovalSchema = createInsertSchema(approvalsTable).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});
export const insertAlertSchema = createInsertSchema(alertsTable).omit({
  id: true,
  createdAt: true,
});
export const insertMemorySchema = createInsertSchema(memoryTable).omit({
  id: true,
  createdAt: true,
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof usersTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;
export type Stakeholder = typeof stakeholdersTable.$inferSelect;
export type Activity = typeof activitiesTable.$inferSelect;
export type Dependency = typeof dependenciesTable.$inferSelect;
export type Change = typeof changesTable.$inferSelect;
export type Action = typeof actionsTable.$inferSelect;
export type Approval = typeof approvalsTable.$inferSelect;
export type Alert = typeof alertsTable.$inferSelect;
export type Memory = typeof memoryTable.$inferSelect;