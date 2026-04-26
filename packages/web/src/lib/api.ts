const API_BASE = process.env.NEXT_PUBLIC_KODY_API_URL || "http://localhost:3456";

const TOKEN_KEY = "kody_admin_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
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

// ── Auth ────────────────────────────────────────────────────

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

// ── Sites ───────────────────────────────────────────────────

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

export async function updateSite(
  siteId: string,
  config: Record<string, unknown>,
): Promise<unknown> {
  const res = await apiFetch(`/api/admin/sites/${siteId}`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to update site");
  return res.json();
}

export async function deleteSite(siteId: string): Promise<void> {
  const res = await apiFetch(`/api/admin/sites/${siteId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete site");
}

// ── Users ───────────────────────────────────────────────────

export async function fetchUsers(): Promise<unknown[]> {
  const res = await apiFetch("/api/admin/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
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
  const res = await apiFetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete user");
}
