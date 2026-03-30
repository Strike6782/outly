import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { JwtPayload } from "jsonwebtoken";

interface DecodedToken extends JwtPayload {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

/**
 * Auth middleware — verifies JWT Bearer token and sets req.user.
 *
 * WHY early return on each failure: Express 5 doesn't stop execution after
 * res.json() — without return, the code falls through to next() and tries
 * to set headers twice, crashing with "Cannot set headers after sent".
 */
export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ message: "Authorization header missing" });
    return;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ message: "Invalid authorization format" });
    return;
  }

  try {
    const decoded = verifyAccessToken(token) as DecodedToken;

    req.user = {
      id: decoded.id,
      email: decoded.email,
    };

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
