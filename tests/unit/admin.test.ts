import { describe, it, expect } from 'vitest';
import { isAdminEmail, isUserAdmin, DESIGNATED_ADMIN_EMAILS } from '../../src/config/admins';

describe('Admin Governance & RBAC Helper Utility', () => {
  it('validates designated admin emails regardless of casing or whitespace', () => {
    expect(isAdminEmail('maestrocerca.mx@gmail.com')).toBe(true);
    expect(isAdminEmail('  MAESTROCERCA.MX@GMAIL.COM  ')).toBe(true);
    expect(isAdminEmail('admin@maestrocerca.mx')).toBe(true);
    expect(isAdminEmail('admin@zibata.mx')).toBe(true);
  });

  it('rejects unauthorized or arbitrary emails', () => {
    expect(isAdminEmail('attacker@evil.com')).toBe(false);
    expect(isAdminEmail('client@gmail.com')).toBe(false);
    expect(isAdminEmail('')).toBe(false);
    expect(isAdminEmail(null as any)).toBe(false);
    expect(isAdminEmail(undefined as any)).toBe(false);
  });

  it('validates custom claims cryptographic RBAC (token.admin === true or role === "admin")', () => {
    // Custom claims admin=true takes precedence even if email is different
    expect(isUserAdmin({ email: 'custom-operator@domain.com' }, { admin: true })).toBe(true);
    expect(isUserAdmin({ email: 'custom-operator@domain.com' }, { role: 'admin' })).toBe(true);

    // Negative custom claims with non-admin email
    expect(isUserAdmin({ email: 'custom-operator@domain.com' }, { role: 'worker' })).toBe(false);
    expect(isUserAdmin({ email: 'custom-operator@domain.com' }, { admin: false })).toBe(false);
  });

  it('falls back to designated admin email when custom claims are not present', () => {
    expect(isUserAdmin({ email: 'maestrocerca.mx@gmail.com' }, null)).toBe(true);
    expect(isUserAdmin({ email: 'unauthorized@example.com' }, null)).toBe(false);
  });
});
