import type { Request, Response, NextFunction } from "express";
import type { AdminAuthService } from "../services/admin/auth-service.js";

declare global {
  namespace Express {
    interface Request {
      adminUser?: { id: number; email: string };
    }
  }
}

export function createAdminAuth(authService: AdminAuthService) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const cookieHeader = req.headers.cookie;
    let token: string | undefined;

    if (cookieHeader) {
      const match = cookieHeader.match(/kody_session=([^;]+)/);
      token = match?.[1];
    }

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
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
