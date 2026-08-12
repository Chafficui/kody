const API_BASE = import.meta.env.VITE_KODY_API_URL || "";

const TOKEN_KEY = "kody_admin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

// Auth
export async function login(
  email: string,
  password: string,
): Promise<{ token: string; expiresAt: string }> {
  const res = await apiFetch("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Login failed");
  }
  const data = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  return data;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/api/admin/logout", { method: "POST" });
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// Sites
export async function fetchSites(): Promise<unknown[]> {
  const res = await apiFetch("/api/admin/sites");
  if (!res.ok) throw new Error("Failed to fetch sites");
  return res.json();
}

export async function fetchSite(siteId: string): Promise<unknown> {
  const res = await apiFetch(`/api/admin/sites/${siteId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch site");
  return res.json();
}

export async function createSite(config: Record<string, unknown>): Promise<unknown> {
  const res = await apiFetch("/api/admin/sites", {
    method: "POST",
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to create site");
  return res.json();
}

export async function updateSite(siteId: string, config: Record<string, unknown>): Promise<unknown> {
  const res = await apiFetch(`/api/admin/sites/${siteId}`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update site");
  return res.json();
}

export async function deleteSite(siteId: string): Promise<void> {
  const res = await apiFetch(`/api/admin/sites/${siteId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete site");
}

// Logs
export async function fetchLogs(options?: {
  level?: string;
  since?: number;
  limit?: number;
}): Promise<{ entries: Array<{ id: number; timestamp: string; level: string; message: string }> }> {
  const params = new URLSearchParams();
  if (options?.level) params.set("level", options.level);
  if (options?.since) params.set("since", String(options.since));
  if (options?.limit) params.set("limit", String(options.limit));
  const qs = params.toString();
  const res = await apiFetch(`/api/admin/logs${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}

export async function clearLogs(): Promise<void> {
  const res = await apiFetch("/api/admin/logs", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear logs");
}

// Users
export async function fetchUsers(): Promise<unknown[]> {
  const res = await apiFetch("/api/admin/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

// Tool test (admin only)
export interface ToolTestResult {
  ok: boolean;
  name: string;
  result: string;
  truncated: boolean;
  displayText: string;
  tool: {
    name: string;
    description: string;
    endpoint: string;
    method: string;
  };
}

export async function testTool(
  siteId: string,
  toolName: string,
  args: Record<string, unknown>,
  tool?: Record<string, unknown>,
): Promise<ToolTestResult> {
  const res = await apiFetch(
    `/api/admin/sites/${encodeURIComponent(siteId)}/tools/${encodeURIComponent(toolName)}/test`,
    {
      method: "POST",
      // When the caller passes a tool definition (the current form
      // draft), the server runs the test against that draft instead of
      // the saved site config — so unsaved URL / method / auth edits
      // are reflected immediately.
      body: JSON.stringify({ arguments: args, tool }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body && typeof body === "object" && "error" in body && body.error?.message) ||
      `Tool test failed (${res.status})`;
    throw new Error(msg);
  }
  return body as ToolTestResult;
}

export async function createUser(email: string, password: string): Promise<unknown> {
  const res = await apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Failed to create user");
  return res.json();
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete user");
}
