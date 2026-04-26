import { Router, type Router as RouterType } from "express";
import { adminLoginSchema } from "@kody/shared";
import type { AdminAuthService } from "../../services/admin/auth-service.js";

export function createAdminAuthRouter(authService: AdminAuthService): RouterType {
  const router: RouterType = Router();

  router.post("/login", async (req, res) => {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: "Invalid request", details: parsed.error.issues } });
      return;
    }

    const session = await authService.login(parsed.data.email, parsed.data.password);
    if (!session) {
      res.status(401).json({ error: { message: "Invalid email or password" } });
      return;
    }

    res.cookie("kody_session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({ token: session.token, expiresAt: session.expiresAt });
  });

  router.post("/logout", (req, res) => {
    const cookieHeader = req.headers.cookie;
    const match = cookieHeader?.match(/kody_session=([^;]+)/);
    const token = match?.[1] || req.headers.authorization?.slice(7);

    if (token) {
      authService.logout(token);
    }

    res.clearCookie("kody_session", { path: "/" });
    res.json({ success: true });
  });

  return router;
}
