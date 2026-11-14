// Zugangscodes: Zeichenvorrat ohne leicht verwechselbare Zeichen (I, L, O, 0, 1).
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const FORBIDDEN = /[IL01O]/i;

/** Normalisiert eine Eingabe: Großbuchstaben, nur erlaubte Zeichen. */
export function normalizeCode(input: string): string {
  return (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Formatiert in Vierergruppen: ABCDEFGHJKMN → ABCD-EFGH-JKMN */
export function formatCode(input: string): string {
  const n = normalizeCode(input).replace(/[IL01O]/g, '');
  return (n.match(/.{1,4}/g) || []).join('-');
}

export function containsForbiddenChars(input: string): boolean {
  return FORBIDDEN.test(normalizeCode(input));
}

export function isPlausibleCode(input: string): boolean {
  const n = normalizeCode(input);
  return n.length >= 8 && n.length <= 16 && [...n].every((c) => CODE_ALPHABET.includes(c));
}

/** Kryptografisch zufällige Zeichen ohne Modulo-Verzerrung. */
export function randomCodeChars(length: number): string {
  const out: string[] = [];
  const buf = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < 248) out.push(CODE_ALPHABET[b % 31]);
      if (out.length === length) break;
    }
  }
  return out.join('');
}

export function generateCode(length = 12): string {
  return formatCode(randomCodeChars(length));
}

export function generatePseudonym(prefix: 'P' | 'G' | 'D' = 'P'): string {
  return `${prefix}-${randomCodeChars(4)}`;
}

/** UUID v4 mit crypto.getRandomValues (funktioniert auch ohne „sicheren Kontext“). */
export function uuid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
