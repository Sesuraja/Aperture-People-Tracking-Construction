import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import {
  getCollectionDocs,
  upsertDoc,
  deleteDocById,
  deleteDocsByFilter,
  getDocById,
  logAuditEvent,
  getAuditLogs
} from '../services/db.js';
import { requireAuth, requirePermission, AuthRequest } from '../middleware/auth.js';
import { sanitizeUser } from './auth.js';
import { DEFAULT_ROLE_PERMISSIONS } from '../../constants/permissions.js';

export const adminRouter = Router();

// Apply auth middleware to all admin routes
adminRouter.use(requireAuth);

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
  role: z.string().optional().default('viewer')
});

const setRoleSchema = z.object({
  userId: z.string().optional(),
  email: z.string().optional(),
  role: z.string().min(1)
});

const updatePermissionsSchema = z.object({
  rolePermissions: z.array(z.object({
    role: z.string(),
    permissions: z.array(z.string())
  }))
});

// GET /api/admin/users
adminRouter.get('/users', requirePermission('settings'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await getCollectionDocs('users');
    const sanitized = users.map(u => sanitizeUser(u));
    return res.json({ users: sanitized });
  } catch (err: any) {
    console.error('[Admin Route] Get users error:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/admin/create-user
adminRouter.post('/create-user', requirePermission('settings'), async (req: AuthRequest, res: Response) => {
  const parseResult = createUserSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid input',
      details: parseResult.error.issues
    });
  }

  const { email, password, name, role } = parseResult.data;
  const lowerEmail = email.toLowerCase();

  try {
    const users = await getCollectionDocs('users');
    if (users.some((u: any) => u.email?.toLowerCase() === lowerEmail)) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: lowerEmail,
      name: name || lowerEmail.split('@')[0],
      role,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    await upsertDoc('users', newUser);

    await logAuditEvent({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'ADMIN_CREATE_USER',
      resource: 'users',
      details: { targetEmail: lowerEmail, role },
      ip: req.ip
    });

    return res.json({
      message: 'User created successfully',
      user: sanitizeUser(newUser)
    });
  } catch (err: any) {
    console.error('[Admin Route] Create user error:', err);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// POST /api/admin/set-user-role
adminRouter.post('/set-user-role', requirePermission('settings'), async (req: AuthRequest, res: Response) => {
  const parseResult = setRoleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid input',
      details: parseResult.error.issues
    });
  }

  const { userId, email, role } = parseResult.data;

  try {
    const users = await getCollectionDocs('users');
    const user = users.find((u: any) =>
      (userId && u.id === userId) || (email && u.email?.toLowerCase() === email.toLowerCase())
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const prevRole = user.role;
    user.role = role;
    await upsertDoc('users', user);

    await logAuditEvent({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'ADMIN_CHANGE_USER_ROLE',
      resource: 'users',
      details: { targetUser: user.email, prevRole, newRole: role },
      ip: req.ip
    });

    return res.json({
      message: 'User role updated',
      user: sanitizeUser(user)
    });
  } catch (err: any) {
    console.error('[Admin Route] Set user role error:', err);
    return res.status(500).json({ error: 'Failed to update user role' });
  }
});

// DELETE /api/admin/users/:id
adminRouter.delete('/users/:id', requirePermission('settings'), async (req: AuthRequest, res: Response) => {
  const userId = req.params.id;

  try {
    const user = await getDocById('users', userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email?.toLowerCase() === req.user?.email?.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    await deleteDocById('users', userId);

    await logAuditEvent({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'ADMIN_DELETE_USER',
      resource: 'users',
      details: { targetUser: user.email, targetId: userId },
      ip: req.ip
    });

    return res.json({ message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('[Admin Route] Delete user error:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/admin/permissions
adminRouter.get('/permissions', requirePermission('settings'), async (req: AuthRequest, res: Response) => {
  try {
    const rolePermissions = await getCollectionDocs('role_permissions');
    if (!rolePermissions || rolePermissions.length === 0) {
      return res.json({ rolePermissions: DEFAULT_ROLE_PERMISSIONS });
    }
    return res.json({ rolePermissions });
  } catch (err: any) {
    console.error('[Admin Route] Get permissions error:', err);
    return res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// POST /api/admin/permissions
adminRouter.post('/permissions', requirePermission('settings'), async (req: AuthRequest, res: Response) => {
  const parseResult = updatePermissionsSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid permissions payload',
      details: parseResult.error.issues
    });
  }

  try {
    for (const item of parseResult.data.rolePermissions) {
      await upsertDoc('role_permissions', {
        id: item.role,
        role: item.role,
        permissions: item.permissions
      });
    }

    await logAuditEvent({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'ADMIN_UPDATE_PERMISSIONS',
      resource: 'role_permissions',
      details: { updatedRoles: parseResult.data.rolePermissions.map(r => r.role) },
      ip: req.ip
    });

    return res.json({ message: 'Permissions updated successfully' });
  } catch (err: any) {
    console.error('[Admin Route] Update permissions error:', err);
    return res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// GET /api/admin/audit-logs
adminRouter.get('/audit-logs', requirePermission('audit'), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await getAuditLogs(200);
    return res.json({ logs });
  } catch (err: any) {
    console.error('[Admin Route] Get audit logs error:', err);
    return res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// POST /api/admin/users/:id/revoke-sessions
adminRouter.post('/users/:id/revoke-sessions', requirePermission('settings'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const userDoc = await getDocById('users', id);
    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    userDoc.tokenVersion = (userDoc.tokenVersion || 1) + 1;
    await upsertDoc('users', userDoc);

    await logAuditEvent({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'ADMIN_REVOKED_USER_SESSIONS',
      resource: 'users',
      details: { targetUserId: id, targetEmail: userDoc.email, newVersion: userDoc.tokenVersion },
      ip: req.ip
    });

    return res.json({ message: `Revoked all active sessions for user ${userDoc.email}` });
  } catch (err: any) {
    console.error('[Admin Route] Revoke sessions error:', err);
    return res.status(500).json({ error: 'Failed to revoke user sessions' });
  }
});

// GET /api/admin/data-retention
adminRouter.get('/data-retention', requirePermission('settings'), async (req: AuthRequest, res: Response) => {
  try {
    const retentionDoc = await getDocById('settings', 'retention_policy');
    const defaultPolicy = {
      id: 'retention_policy',
      tagHistoryRetentionDays: 60,
      staleLiveTagHours: 24,
      auditLogRetentionDays: 180,
      lastExecuted: retentionDoc?.lastExecuted || null
    };

    return res.json({ policy: retentionDoc || defaultPolicy });
  } catch (err: any) {
    console.error('[Admin Route] Get retention policy error:', err);
    return res.status(500).json({ error: 'Failed to fetch retention policy' });
  }
});

// POST /api/admin/data-retention
adminRouter.post('/data-retention', requirePermission('settings'), async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    tagHistoryRetentionDays: z.number().min(1).max(3650),
    staleLiveTagHours: z.number().min(1).max(720),
    auditLogRetentionDays: z.number().min(7).max(3650)
  });

  const parseResult = schema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid retention policy inputs', details: parseResult.error.issues });
  }

  try {
    const existing = await getDocById('settings', 'retention_policy');
    const policyDoc = {
      id: 'retention_policy',
      ...parseResult.data,
      lastExecuted: existing?.lastExecuted || null,
      updatedAt: new Date().toISOString()
    };

    await upsertDoc('settings', policyDoc);

    await logAuditEvent({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'ADMIN_UPDATE_RETENTION_POLICY',
      resource: 'settings',
      details: parseResult.data,
      ip: req.ip
    });

    return res.json({ message: 'Data retention policy saved successfully', policy: policyDoc });
  } catch (err: any) {
    console.error('[Admin Route] Update retention policy error:', err);
    return res.status(500).json({ error: 'Failed to update retention policy' });
  }
});

// POST /api/admin/data-retention/execute
adminRouter.post('/data-retention/execute', requirePermission('settings'), async (req: AuthRequest, res: Response) => {
  try {
    const retentionDoc = await getDocById('settings', 'retention_policy');
    const tagHistoryRetentionDays = retentionDoc?.tagHistoryRetentionDays || 60;
    const staleLiveTagHours = retentionDoc?.staleLiveTagHours || 24;

    const now = Date.now();
    const historyCutoff = new Date(now - tagHistoryRetentionDays * 24 * 60 * 60 * 1000).toISOString();
    const liveTagCutoff = new Date(now - staleLiveTagHours * 60 * 60 * 1000).toISOString();

    // Purge old history records
    const purgedHistoryCount = await deleteDocsByFilter('tag_history', (doc: any) => {
      if (!doc.timestamp) return false;
      return new Date(doc.timestamp).toISOString() < historyCutoff;
    });

    // Purge stale live tags
    const purgedLiveTagsCount = await deleteDocsByFilter('live_tags', (doc: any) => {
      if (!doc.lastSeen) return false;
      return new Date(doc.lastSeen).toISOString() < liveTagCutoff;
    });

    const executionTimestamp = new Date().toISOString();
    const updatedPolicy = {
      ...(retentionDoc || { id: 'retention_policy', tagHistoryRetentionDays, staleLiveTagHours }),
      id: 'retention_policy',
      lastExecuted: executionTimestamp,
      lastPurgedCounts: { history: purgedHistoryCount, liveTags: purgedLiveTagsCount }
    };

    await upsertDoc('settings', updatedPolicy);

    await logAuditEvent({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'DATA_RETENTION_CLEANUP_EXECUTED',
      resource: 'data_retention',
      details: { purgedHistoryCount, purgedLiveTagsCount, historyCutoff, liveTagCutoff },
      ip: req.ip
    });

    return res.json({
      message: 'Data retention policy enforcement executed successfully',
      purgedHistoryCount,
      purgedLiveTagsCount,
      lastExecuted: executionTimestamp
    });
  } catch (err: any) {
    console.error('[Admin Route] Execute retention cleanup error:', err);
    return res.status(500).json({ error: 'Failed to execute data retention cleanup' });
  }
});
