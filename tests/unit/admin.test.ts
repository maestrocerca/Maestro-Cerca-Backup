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

  it('validates custom claims cryptographic RBAC (strictly token.admin === true)', () => {
    // Custom claims admin=true is the sole authority
    expect(isUserAdmin({ email: 'custom-operator@domain.com' }, { admin: true })).toBe(true);
    expect(isUserAdmin({ email: 'admin@maestrocerca.mx' }, { admin: true })).toBe(true);

    // Negative custom claims or role strings without admin: true are rejected
    expect(isUserAdmin({ email: 'custom-operator@domain.com' }, { role: 'admin' })).toBe(false);
    expect(isUserAdmin({ email: 'custom-operator@domain.com' }, { role: 'worker' })).toBe(false);
    expect(isUserAdmin({ email: 'custom-operator@domain.com' }, { admin: false })).toBe(false);
  });

  it('rejects authorization based on designated admin email when admin custom claim is absent', () => {
    // Designated emails alone DO NOT grant admin authority without admin:true claim
    expect(isUserAdmin({ email: 'maestrocerca.mx@gmail.com' }, null)).toBe(false);
    expect(isUserAdmin({ email: 'maestrocerca.mx@gmail.com' }, {})).toBe(false);
    expect(isUserAdmin({ email: 'unauthorized@example.com' }, null)).toBe(false);
  });

  it('safely handles null, undefined, or missing user/email without throwing TypeError', () => {
    expect(isUserAdmin(null)).toBe(false);
    expect(isUserAdmin(undefined)).toBe(false);
    expect(isUserAdmin({ email: null })).toBe(false);
    expect(isUserAdmin({ email: undefined })).toBe(false);
    expect(isUserAdmin({})).toBe(false);
  });
});
