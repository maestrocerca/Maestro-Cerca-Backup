import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeRecord, checkRateLimit, removeUndefinedFields } from '../../src/lib/sanitize';

describe('Sanitization & Rate Limiting Utility', () => {
  describe('sanitizeText', () => {
    it('strips <script> tags and embedded payloads', () => {
      const malicious = '<script>alert("xss")</script>Hola Maestro';
      expect(sanitizeText(malicious)).toBe('Hola Maestro');
    });

    it('strips HTML markup and leaves pure clean text', () => {
      const input = '<h1>Servicio de <strong>Plomería</strong> en Zibatá</h1>';
      expect(sanitizeText(input)).toBe('Servicio de Plomería en Zibatá');
    });

    it('strips malicious event handlers (onerror, onclick, onload)', () => {
      const withOnError = '<img src="invalid.jpg" onerror="alert(document.cookie)" />Fotografía de obra';
      expect(sanitizeText(withOnError)).toBe('Fotografía de obra');

      const withOnClick = '<button onclick="evil()">Contacto</button>';
      expect(sanitizeText(withOnClick)).toBe('Contacto');
    });

    it('neutralizes pseudo-protocols (javascript:, vbscript:)', () => {
      const input = 'javascript:stealCredentials()';
      expect(sanitizeText(input)).not.toContain('javascript:');
    });

    it('handles empty, null, or undefined values gracefully', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText(null)).toBe('');
      expect(sanitizeText(undefined)).toBe('');
    });
  });

  describe('sanitizeRecord', () => {
    it('recursively cleans string fields across nested objects', () => {
      const raw = {
        title: '<b>Instalador Eléctrico</b>',
        rating: 4.9,
        active: true,
        details: {
          bio: '<script>evil()</script>Especialista en tableros trifásicos.',
          tags: ['<i>residencial</i>', '<script>bad()</script>zibatá'],
        },
      };

      const clean = sanitizeRecord(raw);
      expect(clean.title).toBe('Instalador Eléctrico');
      expect(clean.rating).toBe(4.9);
      expect(clean.active).toBe(true);
      expect(clean.details.bio).toBe('Especialista en tableros trifásicos.');
      expect(clean.details.tags[0]).toBe('residencial');
      expect(clean.details.tags[1]).toBe('zibatá');
    });
  });

  describe('checkRateLimit', () => {
    it('allows initial call and restricts rapid immediate subsequent clicks', () => {
      const actionKey = `test-action-${Date.now()}`;
      
      // First attempt: should succeed
      const firstTry = checkRateLimit(actionKey, 1000);
      expect(firstTry).toBe(true);

      // Immediate second attempt: must be blocked by rate limiter
      const rapidSecondTry = checkRateLimit(actionKey, 1000);
      expect(rapidSecondTry).toBe(false);
    });

    it('manages different action keys independently without cross-blocking', () => {
      const now = Date.now();
      const keyA = `userA-${now}`;
      const keyB = `userB-${now}`;

      expect(checkRateLimit(keyA, 1000)).toBe(true);
      expect(checkRateLimit(keyB, 1000)).toBe(true);
    });
  });

  describe('removeUndefinedFields (Firestore payload safety)', () => {
    it('removes top-level undefined fields without mutating original object', () => {
      const payload = {
        nombre: 'Carlos López',
        phoneVerified: false,
        phoneVerifiedAt: undefined,
        phoneVerificationMethod: undefined,
        nivel: 'Aspirante',
        aprobado: false,
      };

      const clean = removeUndefinedFields(payload);
      expect('phoneVerifiedAt' in clean).toBe(false);
      expect('phoneVerificationMethod' in clean).toBe(false);
      expect(clean.phoneVerified).toBe(false);
      expect(clean.nombre).toBe('Carlos López');
      expect(clean.nivel).toBe('Aspirante');
      expect(clean.aprobado).toBe(false);
    });

    it('preserves null, boolean false, number 0, and empty string fields', () => {
      const payload = {
        pendingProfilePhotoPath: null,
        phoneVerified: false,
        yearsExperience: 0,
        fotoUrl: '',
        tags: [],
        ignored: undefined,
      };

      const clean = removeUndefinedFields(payload);
      expect(clean.pendingProfilePhotoPath).toBeNull();
      expect(clean.phoneVerified).toBe(false);
      expect(clean.yearsExperience).toBe(0);
      expect(clean.fotoUrl).toBe('');
      expect(clean.tags).toEqual([]);
      expect('ignored' in clean).toBe(false);
    });

    it('recursively cleans nested objects and arrays of objects', () => {
      const payload = {
        info: {
          trade: 'Plomero',
          subTrade: undefined,
        },
        items: [
          { id: 1, title: 'Bomba', note: undefined },
          { id: 2, title: 'Tubería' },
        ],
      };

      const clean = removeUndefinedFields(payload);
      expect(clean.info.trade).toBe('Plomero');
      expect('subTrade' in clean.info).toBe(false);
      expect(clean.items[0].title).toBe('Bomba');
      expect('note' in clean.items[0]).toBe(false);
    });
  });
});
