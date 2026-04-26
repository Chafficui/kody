import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error("Unhandled error:", err.message);

  const status = "statusCode" in err ? (err as { statusCode: number }).statusCode : 500;

  res.status(status).json({
    error: {
      message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    },
  });
}
