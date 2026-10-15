// src/lib/crypto.ts — field-level encryption for sensitive PII (standards §19.7). An entity column listed under
// `encrypted:` in os.yaml is AES-256-GCM ciphertext at rest, bound by AAD to its table, column and row, with a keyed
// blind index beside it for equality lookups. Keys come from the environment, never the database.
import 'server-only';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

function keys(): Record<string, Buffer> {
  return Object.fromEntries((process.env.FIELD_ENC_KEYS ?? '').split(',').filter(Boolean).map((pair) => {
    const [version, b64] = pair.split(':'); return [version, Buffer.from(b64 || '', 'base64')];
  }));
}
export const encryptionConfigured = () => Object.keys(keys()).length > 0;

export function encryptField(plain: string, aad: string): string {
  const K = keys(); const current = process.env.FIELD_ENC_CURRENT ?? 'v1';
  if (!K[current] || K[current].length !== 32) throw new Error(`FIELD_ENC_KEYS has no 32-byte key for version ${current}`);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', K[current], iv); cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [current, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

export function decryptField(stored: string, aad: string): string {
  const [version, iv, tag, ct] = stored.split(':'); const K = keys();
  if (!K[version]) throw new Error(`no key for ciphertext version ${version}`);
  const d = createDecipheriv('aes-256-gcm', K[version], Buffer.from(iv, 'base64')); d.setAAD(Buffer.from(aad)); d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
}

export const isCiphertext = (v: unknown) => typeof v === 'string' && /^v\d+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]*$/.test(v);

export function blindIndex(value: string): string {
  return createHmac('sha256', Buffer.from(process.env.BLIND_INDEX_KEY ?? '', 'base64')).update(value.trim().toUpperCase()).digest('hex');
}
