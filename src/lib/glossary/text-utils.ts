/**
 * Shared text utilities for glossary matching and enforcement.
 *
 * Word boundary detection used by both `matcher.ts` and `enforcer.ts`.
 */

/** Characters treated as word boundaries. */
const WORD_BOUNDARY_RE = /[\s,.!?;:()[\]{}"'<>\-/]/;

/**
 * Check if a character is a word boundary.
 */
export function isWordBoundary(char: string): boolean {
  return WORD_BOUNDARY_RE.test(char);
}

/**
 * Check word boundaries around a match in `text` at the given range.
 */
export function checkWordBoundaries(text: string, start: number, end: number): boolean {
  const beforeChar = start > 0 ? text[start - 1]! : ' ';
  const afterChar = end < text.length ? text[end]! : ' ';
  return isWordBoundary(beforeChar) && isWordBoundary(afterChar);
}
