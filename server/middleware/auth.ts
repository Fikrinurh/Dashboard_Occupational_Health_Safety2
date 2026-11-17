import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser, UserRole } from '../../src/shared/types';
import { env } from '../config/env';
import { getRepository } from '../db/adapter';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function signAuthToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] },
  );
}

export async function authenticateJwt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
  const rawToken =
    header && header.startsWith('Bearer ') ? header.slice(7).trim() : queryToken;

  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  try {
    const payload = jwt.verify(rawToken, env.jwtSecret) as { sub: number | string };
    const repo = getRepository();
    const user = await repo.findUserById(Number(payload.sub));
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User account is inactive or no longer exists.' });
      return;
    }
    const { passwordHash: _ph, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}.`,
      });
      return;
    }
    next();
  };
}
