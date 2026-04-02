import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (!(err instanceof ZodError)) {
    console.error(`[Error] ${err.message}`);
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Validation error",
      errors: err.flatten().fieldErrors,
    });
    return;
  }

  const status = "status" in err ? (err as { status: number }).status : 500;
  const message = status === 500 ? "Internal server error" : err.message;

  res.status(status).json({ message });
}
