/** Session ID management via sessionStorage. */

function key(siteId: string): string {
  return `kody_session_${siteId}`;
}

export function getSessionId(siteId: string): string | null {
  try {
    return sessionStorage.getItem(key(siteId));
  } catch {
    return null;
  }
}

export function setSessionId(siteId: string, sessionId: string): void {
  try {
    sessionStorage.setItem(key(siteId), sessionId);
  } catch {
    // storage unavailable — silently ignore
  }
}

export function clearSession(siteId: string): void {
  try {
    sessionStorage.removeItem(key(siteId));
  } catch {
    // storage unavailable — silently ignore
  }
}

/** Generate a random session ID. Uses crypto.randomUUID when available, falls back to a manual v4 UUID. */
export function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: manual v4 UUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
