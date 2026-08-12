import type { Request, Response, NextFunction } from "express";
import type { AdminAuthService } from "../services/admin/auth-service.js";

declare global {
  namespace Express {
    interface Request {
      adminUser?: { id: number; email: string };
    }
  }
}

/**
 * Methods that change server state. For these we require a bearer token
 * (sent by the React admin SPA via `Authorization: Bearer <token>`) so a
 * cross-origin attacker who tricks a logged-in admin's browser into
 * firing a request cannot ride the `kody_session` cookie.
 *
 * Read-only methods (GET / HEAD / OPTIONS) still accept the session
 * cookie, which is how the admin SPA is loaded from `/admin/...`.
 */
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function createAdminAuth(authService: AdminAuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const isStateChanging = STATE_CHANGING_METHODS.has(req.method);

    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    let token: string | undefined = bearerToken;
    if (!token) {
      // Cookie fallback is ONLY allowed for read-only methods. State-
      // changing methods must present a bearer token to defeat CSRF.
      if (isStateChanging) {
        res.status(401).json({
          error: {
            message:
              "Bearer token required for state-changing admin operations",
          },
        });
        return;
      }
      const cookieHeader = req.headers.cookie;
      if (cookieHeader) {
        const match = cookieHeader.match(/kody_session=([^;]+)/);
        token = match?.[1];
      }
    }

    if (!token) {
      res.status(401).json({ error: { message: "Authentication required" } });
      return;
    }

    const user = authService.validateSession(token);
    if (!user) {
      res.status(401).json({ error: { message: "Invalid or expired session" } });
      return;
    }

    req.adminUser = { id: user.id, email: user.email };
    next();
  };
}
