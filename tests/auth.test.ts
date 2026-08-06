import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { generateToken, verifyToken } from '../src/server/middleware/auth.js';
import { sanitizeUser } from '../src/server/routes/auth.js';

describe('Authentication & Token Utilities', () => {
  it('should correctly hash and compare passwords with bcrypt', async () => {
    const rawPassword = 'SecureP@ssword2026';
    const hash = await bcrypt.hash(rawPassword, 10);

    expect(hash).not.toBe(rawPassword);
    
    const isValid = await bcrypt.compare(rawPassword, hash);
    expect(isValid).toBe(true);

    const isWrongValid = await bcrypt.compare('WrongPassword', hash);
    expect(isWrongValid).toBe(false);
  });

  it('should generate and verify signed JWT tokens', () => {
    const mockUser = {
      id: 'usr_999',
      email: 'admin@company.com',
      name: 'Site Admin',
      role: 'admin'
    };

    const token = generateToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe('usr_999');
    expect(decoded?.email).toBe('admin@company.com');
    expect(decoded?.role).toBe('admin');
  });

  it('should reject invalid or tampered JWT tokens', () => {
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature';
    const decoded = verifyToken(invalidToken);
    expect(decoded).toBeNull();
  });

  it('should sanitize user objects by stripping password fields', () => {
    const rawUser = {
      id: 'usr_123',
      email: 'user@domain.com',
      password: 'PlaintextPassword',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz1234567890',
      role: 'manager'
    };

    const clean = sanitizeUser(rawUser);
    expect(clean.id).toBe('usr_123');
    expect(clean.email).toBe('user@domain.com');
    expect(clean.role).toBe('manager');
    expect(clean.password).toBeUndefined();
    expect(clean.passwordHash).toBeUndefined();
  });
});
