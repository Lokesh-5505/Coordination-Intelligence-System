import https from "node:https";
import crypto from "node:crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_WP0HGluMwq3t@ep-cool-sound-ay9qecak-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Extract hostname from DATABASE_URL
let NEON_HOSTNAME = "ep-cool-sound-ay9qecak-pooler.c-5.us-east-2.aws.neon.tech";
try {
  const match = DATABASE_URL.match(/@([^/:]+)/);
  if (match && match[1]) {
    NEON_HOSTNAME = match[1];
  }
} catch {
  // fallback
}

export function ensureUUID(id: string): string {
  if (!id) return crypto.randomUUID();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return id.toLowerCase();
  }
  const hash = crypto.createHash("md5").update(id).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function queryNeon(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql, params });
    const req = https.request(
      {
        hostname: NEON_HOSTNAME,
        port: 443,
        path: "/sql",
        method: "POST",
        headers: {
          "Neon-Connection-String": DATABASE_URL,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 30000,
        family: 4, // Force IPv4 to bypass Windows IPv6 route hangs
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(json.message || `Neon error ${res.statusCode}: ${data}`));
            } else {
              resolve(json.rows || []);
            }
          } catch (e) {
            reject(new Error(`Failed to parse Neon response: ${data}`));
          }
        });
      }
    );

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Neon query timeout (30s)"));
    });

    req.write(body);
    req.end();
  });
}

// ─── Projects CRUD ────────────────────────────────────────────────────────────

export async function neonGetProject(id: string): Promise<any | null> {
  const uuid = ensureUUID(id);
  const rows = await queryNeon(
    "SELECT id, name, description, location, phase, status, progress, owner_id, is_demo, updated_at FROM projects WHERE id = $1 LIMIT 1;",
    [uuid]
  );
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    location: r.location,
    phase: r.phase,
    status: r.status,
    progress: Number(r.progress || 0),
    ownerId: r.owner_id,
    isDemo: Boolean(r.is_demo),
    updatedAt: r.updated_at,
  };
}

export async function neonUpsertProject(p: any): Promise<void> {
  const uuid = ensureUUID(p.id);
  const ownerUuid = p.ownerId ? ensureUUID(p.ownerId) : null;
  await queryNeon(
    `INSERT INTO projects (id, name, description, location, phase, status, progress, owner_id, is_demo, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       location = EXCLUDED.location,
       phase = EXCLUDED.phase,
       status = EXCLUDED.status,
       progress = EXCLUDED.progress,
       is_demo = EXCLUDED.is_demo,
       updated_at = NOW();`,
    [
      uuid,
      p.name,
      p.description || "",
      p.location || "",
      p.phase || "Planning",
      p.status || "On Track",
      Number(p.progress || 0),
      ownerUuid,
      p.isDemo ? true : false,
    ]
  );
}

// ─── Users CRUD ───────────────────────────────────────────────────────────────

export async function neonGetUserByEmail(email: string): Promise<any | null> {
  const rows = await queryNeon(
    "SELECT id, email, password_hash, name, role, project_id, created_at FROM users WHERE email = $1 LIMIT 1;",
    [email.toLowerCase().trim()]
  );
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    name: r.name,
    role: r.role || "admin",
    projectId: r.project_id,
    createdAt: r.created_at,
  };
}

export async function neonGetUserById(id: string): Promise<any | null> {
  const uuid = ensureUUID(id);
  const rows = await queryNeon(
    "SELECT id, email, password_hash, name, role, project_id, created_at FROM users WHERE id = $1 LIMIT 1;",
    [uuid]
  );
  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    name: r.name,
    role: r.role || "admin",
    projectId: r.project_id,
    createdAt: r.created_at,
  };
}

export async function neonGetAllUsers(): Promise<any[]> {
  const rows = await queryNeon(
    "SELECT id, email, password_hash, name, role, project_id, created_at FROM users ORDER BY created_at ASC;"
  );
  return (rows || []).map((r: any) => ({
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    name: r.name,
    role: r.role || "admin",
    projectId: r.project_id,
    createdAt: r.created_at,
  }));
}

export async function neonUpsertUser(u: any): Promise<void> {
  const uuid = ensureUUID(u.id);
  const projectUuid = u.projectId ? ensureUUID(u.projectId) : null;
  const validRoles = ["admin", "member", "viewer"];
  const userRole = validRoles.includes(u.role) ? u.role : "admin";

  await queryNeon(
    `INSERT INTO users (id, email, password_hash, name, role, project_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       project_id = EXCLUDED.project_id;`,
    [
      uuid,
      u.email.toLowerCase().trim(),
      u.passwordHash || u.password || "$2a$10$w3aJDemoPasswordHashPlaceHolder",
      u.name,
      userRole,
      projectUuid,
    ]
  );
}

// ─── Full Project Store in Neon PostgreSQL ────────────────────────────────────

export async function neonGetProjectStore(projectId: string): Promise<any | null> {
  const pUuid = ensureUUID(projectId);
  const project = await neonGetProject(pUuid);
  if (!project) return null;

  const [stakeholders, activities, dependencies, changes, actions, approvals, alerts, memory] =
    await Promise.all([
      queryNeon("SELECT * FROM stakeholders WHERE project_id = $1;", [pUuid]),
      queryNeon("SELECT * FROM activities WHERE project_id = $1 ORDER BY due_date ASC;", [pUuid]),
      queryNeon("SELECT * FROM dependencies WHERE project_id = $1;", [pUuid]),
      queryNeon("SELECT * FROM changes WHERE project_id = $1 ORDER BY created_at DESC;", [pUuid]),
      queryNeon("SELECT * FROM actions WHERE project_id = $1 ORDER BY due_date ASC;", [pUuid]),
      queryNeon("SELECT * FROM approvals WHERE project_id = $1 ORDER BY created_at DESC;", [pUuid]),
      queryNeon("SELECT * FROM alerts WHERE project_id = $1 ORDER BY created_at DESC;", [pUuid]),
      queryNeon("SELECT * FROM memory WHERE project_id = $1 ORDER BY created_at DESC;", [pUuid]),
    ]);

  return {
    project,
    stakeholders: (stakeholders || []).map((s: any) => ({
      id: s.id,
      projectId: s.project_id,
      name: s.name,
      initials: s.initials,
      role: s.role,
      discipline: s.discipline,
      company: s.company,
      email: s.email,
      phone: s.phone,
      whatsapp: s.whatsapp,
      status: s.status || "online",
      ownedCount: Number(s.owned_count || 0),
      affectedByCount: Number(s.affected_by_count || 0),
      raci: s.raci ? (typeof s.raci === "string" ? JSON.parse(s.raci) : s.raci) : {},
    })),
    activities: (activities || []).map((a: any) => ({
      id: a.id,
      projectId: a.project_id,
      title: a.title,
      type: a.type,
      discipline: a.discipline,
      owner: a.owner,
      ownerInitials: a.owner_initials,
      status: a.status || "in-progress",
      dueDate: a.due_date,
      location: a.location,
      criticalPath: Boolean(a.critical_path),
      dependencyCount: Number(a.dependency_count || 0),
      blockedReason: a.blocked_reason,
    })),
    dependencies: (dependencies || []).map((d: any) => ({
      id: d.id,
      projectId: d.project_id,
      fromId: d.from_id,
      fromTitle: d.from_title,
      toId: d.to_id,
      toTitle: d.to_title,
      type: d.type || "blocks",
      status: d.status || "active",
    })),
    changes: (changes || []).map((c: any) => ({
      id: c.id,
      projectId: c.project_id,
      title: c.title,
      summary: c.summary,
      status: c.status || "active",
      severity: c.severity || "medium",
      discipline: c.discipline || "General",
      createdBy: c.created_by || "Project Team",
      affectedCount: Number(c.affected_count || 0),
      rawSignal: c.raw_signal,
      createdAt: c.created_at,
    })),
    actions: (actions || []).map((ac: any) => ({
      id: ac.id,
      projectId: ac.project_id,
      title: ac.title,
      owner: ac.owner,
      ownerInitials: ac.owner_initials,
      status: ac.status || "todo",
      dueDate: ac.due_date,
      priority: ac.priority || "normal",
      source: ac.source,
      createdAt: ac.created_at,
    })),
    approvals: (approvals || []).map((ap: any) => ({
      id: ap.id,
      projectId: ap.project_id,
      title: ap.title,
      requester: ap.requester,
      requesterInitials: ap.requester_initials,
      approver: ap.approver,
      status: ap.status || "pending",
      dueDate: ap.due_date,
      category: ap.category,
      impactSummary: ap.impact_summary,
      completedAt: ap.completed_at,
      createdAt: ap.created_at,
    })),
    alerts: (alerts || []).map((al: any) => ({
      id: al.id,
      projectId: al.project_id,
      title: al.title,
      description: al.description,
      type: al.type || "impact",
      severity: al.severity || "medium",
      acknowledged: Boolean(al.acknowledged),
      createdAt: al.created_at,
    })),
    memory: (memory || []).map((m: any) => ({
      id: m.id,
      projectId: m.project_id,
      title: m.title,
      description: m.description,
      type: m.type || "decision",
      actor: m.actor,
      tags: m.tags ? (Array.isArray(m.tags) ? m.tags : m.tags.split(",")) : [],
      createdAt: m.created_at,
    })),
  };
}

export async function neonSaveFullProjectStore(store: any): Promise<void> {
  const pUuid = ensureUUID(store.project.id);
  await neonUpsertProject(store.project);

  // Activities
  await queryNeon("DELETE FROM activities WHERE project_id = $1;", [pUuid]);
  for (const a of store.activities || []) {
    const actUuid = ensureUUID(a.id);
    const validStatuses = ["blocked", "in-progress", "at-risk", "pending", "complete"];
    const status = validStatuses.includes(a.status) ? a.status : "in-progress";

    await queryNeon(
      `INSERT INTO activities (id, project_id, title, type, discipline, owner, owner_initials, status, due_date, location, critical_path, dependency_count, blocked_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [
        actUuid,
        pUuid,
        a.title,
        a.type || "Deliverable",
        a.discipline || "General",
        a.owner || "Project Lead",
        a.ownerInitials || "PL",
        status,
        a.dueDate || "TBD",
        a.location || "",
        a.criticalPath ? true : false,
        Number(a.dependencyCount || 0),
        a.blockedReason || null,
      ]
    );
  }

  // Stakeholders
  await queryNeon("DELETE FROM stakeholders WHERE project_id = $1;", [pUuid]);
  for (const s of store.stakeholders || []) {
    const stkUuid = ensureUUID(s.id);
    const validStatuses = ["online", "on-site", "in-meeting", "offline"];
    const status = validStatuses.includes(s.status) ? s.status : "online";

    await queryNeon(
      `INSERT INTO stakeholders (id, project_id, name, initials, role, discipline, company, email, phone, whatsapp, status, owned_count, affected_by_count, raci, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [
        stkUuid,
        pUuid,
        s.name,
        s.initials || "ST",
        s.role || "Team Member",
        s.discipline || "General",
        s.company || "",
        s.email || "",
        s.phone || "",
        s.whatsapp || "",
        status,
        Number(s.ownedCount || 0),
        Number(s.affectedByCount || 0),
        JSON.stringify(s.raci || {}),
      ]
    );
  }

  // Dependencies
  await queryNeon("DELETE FROM dependencies WHERE project_id = $1;", [pUuid]);
  for (const d of store.dependencies || []) {
    const depUuid = ensureUUID(d.id);
    const fromUuid = ensureUUID(d.fromId);
    const toUuid = ensureUUID(d.toId);
    const validTypes = ["blocks", "depends-on", "relates-to"];
    const type = validTypes.includes(d.type) ? d.type : "blocks";
    const validStatuses = ["active", "resolved"];
    const status = validStatuses.includes(d.status) ? d.status : "active";

    await queryNeon(
      `INSERT INTO dependencies (id, project_id, from_id, from_title, to_id, to_title, type, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (id) DO NOTHING;`,
      [depUuid, pUuid, fromUuid, d.fromTitle || "", toUuid, d.toTitle || "", type, status]
    );
  }

  // Changes
  await queryNeon("DELETE FROM changes WHERE project_id = $1;", [pUuid]);
  for (const c of store.changes || []) {
    const chgUuid = ensureUUID(c.id);
    const validSeverities = ["low", "medium", "high", "critical"];
    const severity = validSeverities.includes(c.severity) ? c.severity : "medium";
    const validStatuses = ["active", "resolved", "monitoring"];
    const status = validStatuses.includes(c.status) ? c.status : "active";
    const cCreatedAt = c.createdAt && !isNaN(new Date(c.createdAt).getTime())
      ? new Date(c.createdAt).toISOString()
      : new Date().toISOString();

    await queryNeon(
      `INSERT INTO changes (id, project_id, title, summary, status, severity, created_by, discipline, affected_count, raw_signal, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING;`,
      [
        chgUuid,
        pUuid,
        c.title,
        c.summary || "",
        status,
        severity,
        c.createdBy || "Project Lead",
        c.discipline || "General",
        Number(c.affectedCount || 0),
        c.rawSignal || "",
        cCreatedAt,
      ]
    );
  }

  // Actions
  await queryNeon("DELETE FROM actions WHERE project_id = $1;", [pUuid]);
  for (const ac of store.actions || []) {
    const actnUuid = ensureUUID(ac.id);
    const validStatuses = ["todo", "in-progress", "done"];
    const status = validStatuses.includes(ac.status) ? ac.status : "todo";
    const validPriorities = ["low", "normal", "high", "urgent"];
    const priority = validPriorities.includes(ac.priority) ? ac.priority : "normal";
    const acCreatedAt = ac.createdAt && !isNaN(new Date(ac.createdAt).getTime())
      ? new Date(ac.createdAt).toISOString()
      : new Date().toISOString();

    await queryNeon(
      `INSERT INTO actions (id, project_id, title, owner, owner_initials, status, due_date, source, priority, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING;`,
      [
        actnUuid,
        pUuid,
        ac.title,
        ac.owner || "Project Lead",
        ac.ownerInitials || "PL",
        status,
        ac.dueDate || "TBD",
        ac.source || "Coordination System",
        priority,
        acCreatedAt,
      ]
    );
  }

  // Approvals
  await queryNeon("DELETE FROM approvals WHERE project_id = $1;", [pUuid]);
  for (const ap of store.approvals || []) {
    const appUuid = ensureUUID(ap.id);
    const validStatuses = ["pending", "approved", "rejected"];
    const status = validStatuses.includes(ap.status) ? ap.status : "pending";
    const apCreatedAt = ap.createdAt && !isNaN(new Date(ap.createdAt).getTime())
      ? new Date(ap.createdAt).toISOString()
      : new Date().toISOString();

    await queryNeon(
      `INSERT INTO approvals (id, project_id, title, requester, requester_initials, approver, status, due_date, category, impact_summary, completed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO NOTHING;`,
      [
        appUuid,
        pUuid,
        ap.title,
        ap.requester || "Team Member",
        ap.requesterInitials || "TM",
        ap.approver || "Authority",
        status,
        ap.dueDate || "TBD",
        ap.category || "Technical Submittal",
        ap.impactSummary || "",
        ap.completedAt || null,
        apCreatedAt,
      ]
    );
  }

  // Alerts
  await queryNeon("DELETE FROM alerts WHERE project_id = $1;", [pUuid]);
  for (const al of store.alerts || []) {
    const altUuid = ensureUUID(al.id);
    const validTypes = ["impact", "deadline", "approval", "info"];
    const type = validTypes.includes(al.type) ? al.type : "impact";
    const validSeverities = ["low", "medium", "high", "critical"];
    const severity = validSeverities.includes(al.severity) ? al.severity : "medium";
    const alCreatedAt = al.createdAt && !isNaN(new Date(al.createdAt).getTime())
      ? new Date(al.createdAt).toISOString()
      : new Date().toISOString();

    await queryNeon(
      `INSERT INTO alerts (id, project_id, title, description, type, severity, acknowledged, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING;`,
      [
        altUuid,
        pUuid,
        al.title,
        al.description || "",
        type,
        severity,
        al.acknowledged ? true : false,
        alCreatedAt,
      ]
    );
  }

  // Memory
  await queryNeon("DELETE FROM memory WHERE project_id = $1;", [pUuid]);
  for (const m of store.memory || []) {
    const memUuid = ensureUUID(m.id);
    const validTypes = ["decision", "change", "action", "approval", "milestone", "issue"];
    const type = validTypes.includes(m.type) ? m.type : "decision";
    const tagsStr = Array.isArray(m.tags) ? m.tags.join(",") : m.tags || "";
    const memCreatedAt = m.createdAt && !isNaN(new Date(m.createdAt).getTime())
      ? new Date(m.createdAt).toISOString()
      : new Date().toISOString();

    await queryNeon(
      `INSERT INTO memory (id, project_id, title, description, type, actor, tags, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING;`,
      [
        memUuid,
        pUuid,
        m.title,
        m.description || "",
        type,
        m.actor || "Authority",
        tagsStr,
        memCreatedAt,
      ]
    );
  }
}
