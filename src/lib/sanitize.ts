/**
 * Input sanitization helpers to guard against XSS, injection attacks, and client flood/abuse
 */

/**
 * Strips script tags, onload/onclick handlers, HTML markup, and suspicious protocol schemes
 */
export function sanitizeText(input: string | undefined | null): string {
  if (!input) return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/on\w+\s*=\s*[^\s>]+/gi, '')
    .trim();
}

/**
 * Sanitizes object string fields recursively
 */
export function sanitizeRecord<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeText(value);
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeRecord(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/**
 * In-memory client rate limiter to protect against bot click flooding and duplicate submissions
 */
const lastActionTimestamps = new Map<string, number>();

export function checkRateLimit(actionKey: string, cooldownMs: number = 2000): boolean {
  const now = Date.now();
  const lastTime = lastActionTimestamps.get(actionKey) || 0;
  if (now - lastTime < cooldownMs) {
    return false; // Rate limited (too soon)
  }
  lastActionTimestamps.set(actionKey, now);
  return true; // Allowed
}

