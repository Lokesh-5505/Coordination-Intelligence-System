const envUrl = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
export const SERVER_HOST = envUrl.replace(/\/api$/, "");
export const API_BASE = SERVER_HOST ? `${SERVER_HOST}/api` : "/api";

export async function safeParseResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text || text.trim().length === 0) {
    if (!res.ok) {
      if (res.status === 405 && !import.meta.env.VITE_API_BASE_URL) {
        throw new Error(
          "API endpoint unreachable (HTTP 405). Ensure VITE_API_BASE_URL is configured in Vercel Project Settings pointing to your Render backend."
        );
      }
      throw new Error(`Server returned HTTP ${res.status} (${res.statusText || "Empty response"})`);
    }
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    if (!res.ok) {
      if (text.includes("<!doctype html") || text.includes("<html")) {
        throw new Error(
          `Server returned HTTP ${res.status}. If your backend is hosted on Render free tier, it may be waking up from sleep. Please wait a few seconds and try again.`
        );
      }
      throw new Error(`Server returned HTTP ${res.status}: ${text.slice(0, 150)}`);
    }
    return {} as T;
  }
}

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
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${cleanPath}`, { headers: authHeaders() });
  const data = await safeParseResponse<any>(res);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data as T;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${cleanPath}`, {
    method: "POST",
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await safeParseResponse<any>(res);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data as T;
}

async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${cleanPath}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await safeParseResponse<any>(res);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data as T;
}

async function apiDelete<T>(path: string): Promise<T> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_BASE}${cleanPath}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const data = await safeParseResponse<any>(res);
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data as T;
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
