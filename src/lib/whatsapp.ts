/**
 * WhatsApp Helper & Sanitization Utility for Maestro Cerca (Zibatá)
 * Enforces Mexican mobile phone sanitization (+52 prefix) and secure deep links
 */

/**
 * Cleans a raw phone input typed/pasted into a "10-digit only" field (one that
 * already shows a fixed +52 prefix outside the input). Handles the common case
 * of a user pasting their number WITH the country code included (e.g. copied
 * from WhatsApp as "521 442 123 4567" or "52 442 123 4567") by stripping a
 * redundant leading 52/521 prefix before truncating â€” a naive
 * `.replace(/\D/g, '').slice(0, 10)` would instead keep the first 10 digits of
 * the country code + area code, silently producing a fabricated, wrong number.
 */
export function cleanMexicanPhoneInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('521')) {
    return digits.slice(3, 13);
  }
  if (digits.length > 10 && digits.startsWith('52')) {
    return digits.slice(2, 12);
  }
  return digits.slice(0, 10);
}

/**
 * Sanitizes any raw phone input to standard international Mexican format (+52...)
 * Strips whitespace, dashes, parentheses and non-digit characters.
 */
export function sanitizeMexicanPhone(rawPhone: string): {
  digitsOnly: string;
  e164WithPlus: string;
  waMeFormat: string;
  displayFormat: string;
} {
  if (!rawPhone) {
    return {
      digitsOnly: '',
      e164WithPlus: '',
      waMeFormat: '',
      displayFormat: '',
    };
  }

  // Strip all non-digit characters
  let digits = rawPhone.replace(/\D/g, '');

  // Strip legacy Mexican domestic prefix tokens: 044, 045, 01, or leading zero
  if (digits.startsWith('044') || digits.startsWith('045')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('01')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  // If phone starts with '521' (legacy Mexican mobile prefix in WhatsApp) and has 13 digits
  if (digits.startsWith('521') && digits.length === 13) {
    const national10 = digits.slice(3);
    const standardDigits = `52${national10}`;
    return {
      digitsOnly: standardDigits,
      e164WithPlus: `+${standardDigits}`,
      waMeFormat: standardDigits,
      displayFormat: `${national10.slice(0, 3)} ${national10.slice(3, 6)} ${national10.slice(6)}`,
    };
  }

  // If phone already starts with '52' and has 12 digits (e.g. 524421234567)
  if (digits.startsWith('52') && digits.length === 12) {
    const national10 = digits.slice(2);
    return {
      digitsOnly: digits,
      e164WithPlus: `+${digits}`,
      waMeFormat: digits,
      displayFormat: `${national10.slice(0, 3)} ${national10.slice(3, 6)} ${national10.slice(6)}`,
    };
  }

  // Standard 10-digit Mexican national format (e.g. 4421234567)
  if (digits.length === 10) {
    const standardDigits = `52${digits}`;
    return {
      digitsOnly: standardDigits,
      e164WithPlus: `+${standardDigits}`,
      waMeFormat: standardDigits,
      displayFormat: `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`,
    };
  }

  // If more than 10 digits and ends with 10 digits (e.g., entered +52 442 123 4567 with extras)
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    const standardDigits = `52${last10}`;
    return {
      digitsOnly: standardDigits,
      e164WithPlus: `+${standardDigits}`,
      waMeFormat: standardDigits,
      displayFormat: `${last10.slice(0, 3)} ${last10.slice(3, 6)} ${last10.slice(6)}`,
    };
  }

  // Fallback if digits length is unusual
  const prefixed = digits.startsWith('52') ? digits : `52${digits}`;
  return {
    digitsOnly: prefixed,
    e164WithPlus: `+${prefixed}`,
    waMeFormat: prefixed,
    displayFormat: rawPhone.trim(),
  };
}

/**
 * Builds the official wa.me direct click URL with pre-composed context message
 */
export function buildWhatsAppUrl(
  rawPhone: string,
  maestroNombre: string,
  oficio: string,
  customNote?: string
): string {
  const { waMeFormat } = sanitizeMexicanPhone(rawPhone);
  if (!waMeFormat) return '#';

  const defaultMsg = `¡Hola ${maestroNombre}! Vi tu perfil en Maestro Cerca. Me gustaría consultar tu disponibilidad para un trabajo de ${oficio}.${customNote ? `\n\nDetalle: ${customNote}` : ''}`;
  const encodedMsg = encodeURIComponent(defaultMsg.trim());

  return `https://wa.me/${waMeFormat}?text=${encodedMsg}`;
}
