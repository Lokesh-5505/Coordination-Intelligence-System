const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
export const API_BASE = rawBaseUrl ? `${rawBaseUrl}` : "/api";

function getToken(): string | null {
  return localStorage.getItem("coord_token");
}

function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const deleteActivity = (id: string) =>
  apiDelete<any>(`/activities/${id}`);

export const adoptChangeActions = async (changeId: string) => {
  const impact = await apiGet<{ draftActions?: any[] }>(
    `/changes/${changeId}/impact`,
  );
  return apiPost<{ adopted: number; actions: any[] }>("/actions/adopt", {
    actions: impact.draftActions || [],
  });
};

export const createAction = (body: any) =>
  apiPost<any>("/projects/current/actions", body);

export const createActivity = (body: any) =>
  apiPost<any>("/projects/current/activities", body);

export const createApproval = (body: any) =>
  apiPost<any>("/projects/current/approvals", body);

export const createDependency = (body: any) =>
  apiPost<any>("/projects/current/dependencies", body);

export const createMemory = (body: any) =>
  apiPost<any>("/projects/current/memory", body);

export const createStakeholder = (body: any) =>
  apiPost<any>("/projects/current/stakeholders", body);

export const markAllAlertsRead = async () => {
  try {
    return await apiPost<any>("/projects/current/alerts/acknowledge-all", {});
  } catch {
    const alerts = await apiGet<any[]>("/projects/current/alerts");
    return await Promise.all(
      alerts
        .filter((alert) => !alert.acknowledged)
        .map((alert) => apiPost(`/alerts/${alert.id}/acknowledge`, {})),
    );
  }
};

export const updateActivity = (id: string, body: any) =>
  apiPatch<any>(`/activities/${id}`, body);

export const ingestSignal = (
  rawText: string,
  source: string,
  autoCommit = false,
) =>
  apiPost<any>("/projects/current/ingest-signal", {
    rawText,
    source,
    autoCommit,
  });

// ─── API Functions ────────────────────────────────────────────────────────────
export const api = {
  getOverview: () => apiGet<any>("/projects/current/overview"),
  getBriefing: () => apiGet<any[]>("/projects/current/briefing"),

  getStakeholders: () => apiGet<any[]>("/projects/current/stakeholders"),
  getStakeholder: (id: string) => apiGet<any>(`/stakeholders/${id}`),

  getActivities: () => apiGet<any[]>("/projects/current/activities"),

  getDependencies: () => apiGet<any[]>("/projects/current/dependencies"),

  getChanges: () => apiGet<any[]>("/projects/current/changes"),
  createChange: (body: any) => apiPost<any>("/projects/current/changes", body),
  getChangeImpact: (id: string) => apiGet<any>(`/changes/${id}/impact`),

  getActions: () => apiGet<any[]>("/projects/current/actions"),
  updateAction: (id: string, body: any) =>
    apiPatch<any>(`/actions/${id}`, body),
  adoptActions: (actions: any[]) => apiPost<any>("/actions/adopt", { actions }),

  getApprovals: () => apiGet<any[]>("/projects/current/approvals"),
  updateApproval: (id: string, body: any) =>
    apiPatch<any>(`/approvals/${id}`, body),

  getAlerts: () => apiGet<any[]>("/projects/current/alerts"),
  acknowledgeAlert: (id: string) => apiPost<any>(`/alerts/${id}/acknowledge`, {}),

  getMemory: () => apiGet<any[]>("/projects/current/memory"),

  ask: (question: string) =>
    apiPost<any>("/projects/current/ask", { question }),
  ingestSignal: (body: any) =>
    apiPost<any>("/projects/current/ingest-signal", body),
};

export default api;
