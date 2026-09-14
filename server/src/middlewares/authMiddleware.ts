import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyToken, type JwtPayload } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// In-memory cache for validated user sessions (5 min TTL) to avoid DB roundtrips on every request
const sessionCache = new Map<string, { user: JwtPayload; expiresAt: number }>();

export function invalidateUserSession(userId: string) {
  sessionCache.delete(userId);
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required. Please log in." });
    return;
  }

  const token = header.slice(7).trim();
  const payload = verifyToken(token);

  if (!payload) {
    res
      .status(401)
      .json({ error: "Invalid or expired token. Please log in again." });
    return;
  }

  // Check fast in-memory session cache first (<0.01ms)
  const cached = sessionCache.get(payload.userId);
  if (cached && Date.now() < cached.expiresAt) {
    req.user = cached.user;
    next();
    return;
  }

  // Fallback: If payload already contains valid claims, seed cache and proceed
  if (payload.userId && payload.email && payload.name && payload.role) {
    const userPayload: JwtPayload = {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      projectId: payload.projectId ?? null,
    };
    sessionCache.set(payload.userId, {
      user: userPayload,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    req.user = userPayload;
    next();
    return;
  }

  // Verify against DB if claims were sparse
  try {
    const [user] = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        role: usersTable.role,
        projectId: usersTable.projectId,
      })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Account no longer exists." });
      return;
    }

    const resolvedUser: JwtPayload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      projectId: user.projectId ?? null,
    };

    sessionCache.set(user.id, {
      user: resolvedUser,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    req.user = resolvedUser;
    next();
  } catch (error) {
    console.error("Authorization lookup error:", error);
    res.status(503).json({ error: "Unable to verify account access." });
  }
}
