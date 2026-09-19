import { describe, it, expect } from 'vitest';
import { sanitizeMexicanPhone, buildWhatsAppUrl } from '../../src/lib/whatsapp';

describe('WhatsApp Phone Sanitization & Deep Link Utility', () => {
  it('normalizes standard 10-digit Mexican mobile number to +52 E.164', () => {
    const result = sanitizeMexicanPhone('4421234567');
    expect(result.digitsOnly).toBe('524421234567');
    expect(result.e164WithPlus).toBe('+524421234567');
    expect(result.waMeFormat).toBe('524421234567');
    expect(result.displayFormat).toBe('442 123 4567');
  });

  it('strips non-digit characters (spaces, dashes, parentheses)', () => {
    const result = sanitizeMexicanPhone('(442) 789-0123');
    expect(result.digitsOnly).toBe('524427890123');
    expect(result.e164WithPlus).toBe('+524427890123');
    expect(result.displayFormat).toBe('442 789 0123');
  });

  it('removes obsolete Mexican mobile prefixes (044, 045, 01)', () => {
    const with044 = sanitizeMexicanPhone('044 442 555 1234');
    expect(with044.digitsOnly).toBe('524425551234');
    expect(with044.e164WithPlus).toBe('+524425551234');

    const with045 = sanitizeMexicanPhone('045-442-555-1234');
    expect(with045.digitsOnly).toBe('524425551234');

    const with01 = sanitizeMexicanPhone('01 (442) 555 1234');
    expect(with01.digitsOnly).toBe('524425551234');
  });

  it('handles legacy 13-digit Mexican WhatsApp prefix (521XXXXXXXXXX)', () => {
    const legacyWhatsApp = sanitizeMexicanPhone('+52 1 442 999 8877');
    expect(legacyWhatsApp.digitsOnly).toBe('524429998877');
    expect(legacyWhatsApp.e164WithPlus).toBe('+524429998877');
    expect(legacyWhatsApp.displayFormat).toBe('442 999 8877');
  });

  it('handles numbers already in 12-digit international format (524429998877)', () => {
    const international = sanitizeMexicanPhone('+524429998877');
    expect(international.digitsOnly).toBe('524429998877');
    expect(international.e164WithPlus).toBe('+524429998877');
  });

  it('handles empty, null, or undefined inputs gracefully', () => {
    const empty = sanitizeMexicanPhone('');
    expect(empty.digitsOnly).toBe('');
    expect(empty.e164WithPlus).toBe('');

    const nullInput = sanitizeMexicanPhone(null as any);
    expect(nullInput.digitsOnly).toBe('');
  });

  it('builds secure WhatsApp wa.me links with custom encoded templates', () => {
    const url = buildWhatsAppUrl(
      '4421234567',
      'Don Roberto',
      'Plomería',
      'Reparación de fuga de agua urgente'
    );

    expect(url).toContain('https://wa.me/524421234567?text=');
    expect(url).toContain(encodeURIComponent('Don Roberto'));
    expect(url).toContain(encodeURIComponent('Plomería'));
    expect(url).toContain(encodeURIComponent('Reparación de fuga de agua urgente'));
    expect(url).not.toContain('Zibat%C3%A1');
  });
});
