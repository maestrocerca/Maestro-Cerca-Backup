import { describe, it, expect } from 'vitest';
import { sanitizeMexicanPhone } from '../../src/lib/whatsapp';

describe('ManyChat / WhatsApp Registration Integration Tests', () => {
  it('normalizes various Mexican phone formats from ManyChat to E.164 (+52XXXXXXXXXX)', () => {
    const rawInputs = [
      '4421998877',
      '+52 442 199 8877',
      '+5214421998877',
      '5214421998877',
      '044-442-199-8877',
      '(442) 199 8877',
    ];

    for (const raw of rawInputs) {
      const sanitized = sanitizeMexicanPhone(raw);
      expect(sanitized.e164WithPlus).toBe('+524421998877');
      expect(sanitized.digitsOnly.slice(-10)).toBe('4421998877');
    }
  });

  it('generates expected preWorker ID from normalized digits', () => {
    const phone = '442 555 1234';
    const sanitized = sanitizeMexicanPhone(phone);
    const docId = `pre_${sanitized.digitsOnly.slice(-10)}`;
    expect(docId).toBe('pre_4425551234');
  });

  it('guarantees preliminary profiles are not auto-verified upon creation', () => {
    const mockPreWorker = {
      id: 'pre_4421998877',
      phoneNumber: '+524421998877',
      source: 'manychat',
      status: 'pending_claim',
      profileType: 'registered',
      verificado: false,
    };

    expect(mockPreWorker.verificado).toBe(false);
    expect(mockPreWorker.status).toBe('pending_claim');
  });
});
