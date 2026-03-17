/**
 * Key-based msgid detection
 *
 * Heuristic to determine whether a set of PO entries uses structural keys
 * (e.g. "button.save", "nav_home") instead of natural language source text
 * (e.g. "Save changes"). Used to decide whether to prompt for a source
 * language file upload.
 */

import type { POEntry } from './types';

/**
 * Check if a single msgid looks like a structural key rather than natural text.
 *
 * Key indicators:
 * - No spaces (natural language almost always has spaces)
 * - Contains dot, underscore, or slash separators
 * - Reasonable length (keys tend to be short paths)
 */
function looksLikeKey(msgid: string): boolean {
  const trimmed = msgid.trim();
  if (!trimmed) return false;

  // Natural text usually contains spaces; keys don't
  const hasSpaces = trimmed.includes(' ');
  if (hasSpaces) return false;

  // Keys typically contain separators
  const hasSeparators = /[._/]/.test(trimmed);

  // Single words without separators could be either (e.g. "Save" or "save")
  // Require separators for confidence
  return hasSeparators;
}

/**
 * Determine if a set of entries uses key-based msgids.
 *
 * Samples entries and checks if the majority look like structural keys.
 * Returns true when a source language file would be useful.
 */
export function hasKeyBasedMsgids(entries: POEntry[]): boolean {
  // Need a minimum sample to be confident
  const nonEmpty = entries.filter((e) => e.msgid.trim());
  if (nonEmpty.length === 0) return false;

  const sample = nonEmpty.slice(0, 30);
  const keyCount = sample.filter((e) => looksLikeKey(e.msgid)).length;

  // If >50% of sampled entries look like keys, it's key-based
  return keyCount / sample.length > 0.5;
}
