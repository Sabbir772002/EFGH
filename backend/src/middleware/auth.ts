import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db';

// AuthenticatedRequest — used by all route handlers that require auth
export type AuthenticatedRequest = Request;

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7); // remove "Bearer "

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as {
      userId: string;
      role: 'passenger' | 'driver';
    };

    // Fetch full user profile so routes have name, isOnline, etc.
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, name: true, phone: true, role: true, isOnline: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token is invalid or expired' });
  }
}

// Role guard — use after authMiddleware
export function requireRole(role: 'passenger' | 'driver') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: `Only ${role}s can access this endpoint` });
      return;
    }
    next();
  };
}
