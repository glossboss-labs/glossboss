/**
 * Glossary Matcher
 * 
 * Matches glossary terms in source text using EXACT case-insensitive matching.
 * No fuzzy matching or stemming - "page" will NOT match "pages".
 */

import type { Glossary, GlossaryEntry, GlossaryMatch, MatchOptions } from './types';

/** Default matching options */
const DEFAULT_OPTIONS: Required<MatchOptions> = {
  caseSensitive: false,
  wholeWord: true,
  minLength: 2,
};

/**
 * Check if character is a word boundary
 */
function isWordBoundary(char: string): boolean {
  return /[\s,.!?;:()\[\]{}"'<>\-\/]/.test(char);
}

/**
 * Check word boundaries around a match
 */
function checkWordBoundaries(text: string, start: number, end: number): boolean {
  const beforeChar = start > 0 ? text[start - 1] : ' ';
  const afterChar = end < text.length ? text[end] : ' ';
  return isWordBoundary(beforeChar) && isWordBoundary(afterChar);
}

/**
 * Check if a range overlaps with existing matched positions
 */
function overlapsExisting(
  start: number, 
  end: number, 
  existing: Array<{ start: number; end: number }>
): boolean {
  return existing.some(pos => 
    (start >= pos.start && start < pos.end) ||
    (end > pos.start && end <= pos.end) ||
    (start <= pos.start && end >= pos.end)
  );
}

/**
 * Deduplicate matches by position, keeping highest confidence
 */
function deduplicateMatches(matches: GlossaryMatch[]): GlossaryMatch[] {
  const byPosition = new Map<string, GlossaryMatch>();
  
  for (const match of matches) {
    const key = `${match.startIndex}-${match.endIndex}`;
    const existing = byPosition.get(key);
    
    if (!existing || match.confidence > existing.confidence) {
      byPosition.set(key, match);
    }
  }
  
  return Array.from(byPosition.values());
}

/**
 * Calculate match confidence based on case match
 */
function calculateConfidence(entry: GlossaryEntry, matchedText: string): number {
  // Exact case match = highest confidence
  if (entry.term === matchedText) {
    return 1.0;
  }
  // Case-insensitive match = high confidence
  return 0.95;
}

/**
 * Find glossary matches in text using EXACT matching (case-insensitive).
 * 
 * This function does NOT use fuzzy/stemmed matching. The glossary term
 * must appear exactly in the source text (ignoring case) to be matched.
 * 
 * Examples:
 * - Glossary term "page" matches source "Page" â
 * - Glossary term "page" does NOT match source "pages" â
 * - Glossary term "pages" does NOT match source "page" â
 * - Glossary term "access" does NOT match source "accessing" â
 * 
 * @param text - Source text to search
 * @param glossary - Glossary to match against
 * @param options - Matching options
 * @returns Array of matches with positions
 */
export function findGlossaryMatches(
  text: string,
  glossary: Glossary,
  options: MatchOptions = {}
): GlossaryMatch[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const matches: GlossaryMatch[] = [];
  const matchedPositions: Array<{ start: number; end: number }> = [];
  
  // Sort entries by term length (longest first) to prioritize longer matches
  const sortedEntries = [...glossary.entries]
    .filter(e => e.term.length >= opts.minLength)
    .sort((a, b) => b.term.length - a.term.length);
  
  const searchText = opts.caseSensitive ? text : text.toLowerCase();
  
  // Search for exact matches only
  for (const entry of sortedEntries) {
    const searchTerm = opts.caseSensitive ? entry.term : entry.term.toLowerCase();
    
    let startIndex = 0;
    let foundIndex: number;
    
    // Find all occurrences of the exact term
    while ((foundIndex = searchText.indexOf(searchTerm, startIndex)) !== -1) {
      const endIndex = foundIndex + searchTerm.length;
      
      // Check if this position is already covered by another match
      if (!overlapsExisting(foundIndex, endIndex, matchedPositions)) {
        // Check word boundaries if wholeWord option is enabled
        if (!opts.wholeWord || checkWordBoundaries(searchText, foundIndex, endIndex)) {
          matchedPositions.push({ start: foundIndex, end: endIndex });
          matches.push({
            term: entry.term,
            translation: entry.translation,
            startIndex: foundIndex,
            endIndex,
            confidence: calculateConfidence(entry, text.substring(foundIndex, endIndex)),
          });
        }
      }
      startIndex = foundIndex + 1;
    }
  }
  
  // Deduplicate by position (keep highest confidence)
  const deduped = deduplicateMatches(matches);
  
  // Sort by position
  return deduped.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Apply glossary to translation (placeholder for future implementation)
 * 
 * @param translation - Current translation text
 * @param sourceText - Original source text
 * @param glossary - Glossary to apply
 * @param options - Matching options
 * @returns Translation (unchanged for now)
 */
export function applyGlossaryToTranslation(
  translation: string,
  sourceText: string,
  glossary: Glossary,
  options: MatchOptions = {}
): string {
  // Find matches in source text
  const sourceMatches = findGlossaryMatches(sourceText, glossary, options);
  
  if (sourceMatches.length === 0) {
    return translation;
  }
  
  // For now, just return the translation as-is
  // Actual term replacement would need NLP for proper handling
  return translation;
}

/**
 * Get glossary suggestions for a source string
 * 
 * @param sourceText - Source text
 * @param glossary - Glossary to search
 * @returns Array of term/translation pairs found in the text
 */
export function getGlossarySuggestions(
  sourceText: string,
  glossary: Glossary
): Array<{ term: string; translation: string; comment?: string }> {
  const matches = findGlossaryMatches(sourceText, glossary);
  
  // Deduplicate by term
  const seen = new Set<string>();
  const suggestions: Array<{ term: string; translation: string; comment?: string }> = [];
  
  for (const match of matches) {
    if (!seen.has(match.term.toLowerCase())) {
      seen.add(match.term.toLowerCase());
      
      const entry = glossary.entries.find(e => 
        e.term.toLowerCase() === match.term.toLowerCase()
      );
      
      suggestions.push({
        term: match.term,
        translation: match.translation,
        comment: entry?.comment,
      });
    }
  }
  
  return suggestions;
}
