import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Token-based authentication middleware
 */
export function authenticateToken(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get token from query param or header
    const token = (req.query.token || req.headers["x-auth-token"]) as
      | string
      | undefined;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Use timing-safe comparison to prevent timing oracle attacks
    const expectedBuf = Buffer.from(expectedToken);
    const tokenBuf = Buffer.from(token);
    if (
      expectedBuf.length !== tokenBuf.length ||
      !timingSafeEqual(expectedBuf, tokenBuf)
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    next();
  };
}
