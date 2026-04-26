import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export type AdminLogin = z.infer<typeof adminLoginSchema>;
export type AdminCreateUser = z.infer<typeof adminCreateUserSchema>;
