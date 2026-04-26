import { Router, type Router as RouterType } from "express";
import { adminCreateUserSchema } from "@kody/shared";
import type { AdminAuthService } from "../../services/admin/auth-service.js";

export function createAdminUsersRouter(authService: AdminAuthService): RouterType {
  const router: RouterType = Router();

  router.get("/", (_req, res) => {
    const users = authService.listUsers();
    res.json(users);
  });

  router.post("/", async (req, res) => {
    const parsed = adminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { message: "Invalid request", details: parsed.error.issues } });
      return;
    }

    try {
      const user = await authService.createUser(parsed.data.email, parsed.data.password);
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        res.status(409).json({ error: { message: "Email already exists" } });
        return;
      }
      res.status(500).json({ error: { message: "Failed to create user" } });
    }
  });

  router.delete("/:userId", (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      res.status(400).json({ error: { message: "Invalid user ID" } });
      return;
    }

    if (req.adminUser?.id === userId) {
      res.status(400).json({ error: { message: "Cannot delete your own account" } });
      return;
    }

    const deleted = authService.deleteUser(userId);
    if (!deleted) {
      res.status(404).json({ error: { message: "User not found" } });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
