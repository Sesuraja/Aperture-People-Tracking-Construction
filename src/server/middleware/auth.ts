import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDocById, getCollectionDocs } from '../services/db.js';
import { DEFAULT_PERMISSIONS_MAP } from '../../constants/permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'gao_people_tracking_jwt_secret_key_2026_prod';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  tokenVersion?: number;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name || '',
      role: user.role,
      tokenVersion: user.tokenVersion || 1
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    return decoded;
  } catch (err) {
    return null;
  }
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'] as string;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }

  // Session revocation validation against user DB record
  if (user.id) {
    try {
      const userDoc = await getDocById('users', user.id);
      if (userDoc && userDoc.tokenVersion && userDoc.tokenVersion > (user.tokenVersion || 1)) {
        return res.status(401).json({ error: 'Session revoked. Please log in again.' });
      }
    } catch (err) {
      console.warn('[Auth Middleware] Token version check failed:', err);
    }
  }

  req.user = user;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: requires one of roles [${roles.join(', ')}]` });
    }

    next();
  };
}

export function requirePermission(permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const dbPermissions = await getCollectionDocs('role_permissions');
      let allowedPermissions: string[] = [];

      const roleObj = dbPermissions.find((p: any) => p.role === req.user?.role || p.id === req.user?.role);
      if (roleObj && Array.isArray(roleObj.permissions)) {
        allowedPermissions = roleObj.permissions;
      } else {
        allowedPermissions = DEFAULT_PERMISSIONS_MAP[req.user.role] || [];
      }

      if (!allowedPermissions.includes(permission)) {
        return res.status(403).json({ error: `Forbidden: role '${req.user.role}' lacks permission '${permission}'` });
      }

      next();
    } catch (err) {
      console.error('[Auth Middleware] Error checking permissions:', err);
      res.status(500).json({ error: 'Internal permission validation error' });
    }
  };
}
