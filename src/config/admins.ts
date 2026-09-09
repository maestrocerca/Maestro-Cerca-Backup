/**
 * Centralized Administrator Governance for Maestro Cerca
 * Source of truth for designated administrator identities, custom claims, and verification helpers.
 */

export const DESIGNATED_ADMIN_EMAILS: readonly string[] = [
  'maestrocerca.mx@gmail.com',
  'admin@maestrocerca.mx',
  'admin@zibata.mx',
] as const;

/**
 * Validates if an email address belongs to the designated admin list
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return DESIGNATED_ADMIN_EMAILS.some(
    (adminEmail) => adminEmail.toLowerCase().trim() === normalized
  );
}

/**
 * Validates whether an authenticated user possesses administrative privileges.
 * Seamlessly checks both Firebase Custom Token Claims (e.g. token.admin === true or token.role === 'admin')
 * and the designated project administrator email list.
 */
export function isUserAdmin(
  user?: { email?: string | null; [key: string]: any } | null,
  tokenClaims?: { admin?: boolean; role?: string; [key: string]: any } | null
): boolean {
  if (!user) return false;

  // 1. Check custom token claims (cryptographic RBAC)
  if (tokenClaims?.admin === true || tokenClaims?.role === 'admin') {
    return true;
  }

  // 2. Check designated email list
  return isAdminEmail(user.email);
}
