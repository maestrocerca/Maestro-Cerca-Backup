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
 * Strictly checks Firebase Custom Token Claims (tokenClaims?.admin === true).
 * Email lists are preserved for UX informational purposes only, not security.
 */
export function isUserAdmin(
  _user?: { email?: string | null; [key: string]: any } | null,
  tokenClaims?: { admin?: boolean; [key: string]: any } | null
): boolean {
  return tokenClaims?.admin === true;
}
