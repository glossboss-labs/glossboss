/**
 * Settings Credential Encryption
 *
 * Encrypts/decrypts the credentials portion of cloud settings using
 * AES-256-GCM with a per-user key derived server-side.
 *
 * Format: base64(iv‖ciphertext‖authTag)
 *   - iv: 12 bytes (AES-GCM standard)
 *   - ciphertext + authTag: variable length (tag is 16 bytes, appended by Web Crypto)
 */

import { invokeSupabaseFunction } from '@/lib/supabase/client';
import type { CloudSettingsCredentials } from './types';

const IV_LENGTH = 12;

/** In-memory key cache — deterministic per user session, cleared on page reload. */
let cachedKey: CryptoKey | null = null;

/** Fetch the per-user encryption key from the settings-key edge function. */
async function fetchEncryptionKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const { data, error } = await invokeSupabaseFunction<{ ok: boolean; key: string }>(
    'settings-key',
    { featureLabel: 'Settings', method: 'POST' },
  );

  if (error || !data?.ok || !data.key) {
    throw new Error('Failed to fetch encryption key');
  }

  // Import the raw 256-bit key for AES-GCM
  const rawKey = Uint8Array.from(atob(data.key), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);

  cachedKey = cryptoKey;
  return cryptoKey;
}

/** Clear the cached key (call on sign-out). */
export function clearEncryptionKeyCache(): void {
  cachedKey = null;
}

/** Encrypt credentials to a base64 string. */
export async function encryptCredentials(credentials: CloudSettingsCredentials): Promise<string> {
  const key = await fetchEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = new TextEncoder().encode(JSON.stringify(credentials));

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  // Combine iv + ciphertext (auth tag is appended by Web Crypto)
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);

  return btoa(String.fromCharCode(...combined));
}

/** Decrypt a base64 string back to credentials. Returns null on failure. */
export async function decryptCredentials(
  encrypted: string,
): Promise<CloudSettingsCredentials | null> {
  try {
    const key = await fetchEncryptionKey();
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

    if (combined.length <= IV_LENGTH) return null;

    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

    return JSON.parse(new TextDecoder().decode(plaintext)) as CloudSettingsCredentials;
  } catch {
    // Decryption failure (wrong key, corrupted data, key rotation)
    return null;
  }
}
