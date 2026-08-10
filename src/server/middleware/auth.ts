import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDocById, getCollectionDocs, upsertDoc } from '../services/db.js';
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
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && (decoded.iss?.includes('securetoken.google.com') || decoded.firebase || decoded.aud?.includes('ai-studio-gaopeopletrackin'))) {
        return {
          id: decoded.sub || decoded.uid || decoded.user_id,
          email: decoded.email || '',
          name: decoded.name || decoded.displayName || '',
          role: decoded.role || 'viewer', // synced with DB in requireAuth
          tokenVersion: 1
        };
      }
    } catch (decodeErr) {
      console.warn('[Auth] Failed to decode token as Firebase ID Token:', decodeErr);
    }
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

  // Session revocation validation against user DB record & DB sync
  if (user.id) {
    try {
      let userDoc = await getDocById('users', user.id);
      if (!userDoc && user.email) {
        const users = await getCollectionDocs('users');
        userDoc = users.find((u: any) => u.email?.toLowerCase() === user.email?.toLowerCase());
      }

      if (userDoc) {
        if (userDoc.tokenVersion && userDoc.tokenVersion > (user.tokenVersion || 1)) {
          return res.status(401).json({ error: 'Session revoked. Please log in again.' });
        }
        // Sync role and details from database
        user.role = userDoc.role || user.role;
        user.name = userDoc.name || userDoc.displayName || user.name;
        user.id = userDoc.id || user.id;
      } else {
        // If the user is authenticated in Firebase but doesn't exist in local DB, bootstrap them
        const isInitialAdmin = user.email?.toLowerCase() === 'sigmund.t.d@gaostaff.com' || user.email?.endsWith('@gaostaff.com');
        const role = isInitialAdmin ? 'admin' : 'viewer';
        user.role = role;

        const newUserDoc = {
          id: user.id,
          uid: user.id,
          email: user.email,
          name: user.name || user.email?.split('@')[0] || 'User',
          displayName: user.name || user.email?.split('@')[0] || 'User',
          role: role,
          createdAt: new Date().toISOString()
        };
        await upsertDoc('users', newUserDoc);
      }
    } catch (err) {
      console.warn('[Auth Middleware] Token DB check and sync failed:', err);
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
