/**
 * PO File Parser
 * 
 * Parses GNU gettext .po file content into structured data.
 * Handles edge cases gracefully with detailed error messages.
 * 
 * References:
 * - https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html
 */

import type { 
  POFile, 
  POEntry, 
  POHeader, 
  POEntryFlag,
  ParseOptions, 
  ParseResult,
  ParseIssue,
  ParseErrorCode,
  ValidationResult 
} from './types';

// ============================================================================
// Constants
// ============================================================================

/** UTF-8 BOM character */
const UTF8_BOM = '\uFEFF';

/** Default parse options */
const DEFAULT_OPTIONS: Required<ParseOptions> = {
  generateIds: true,
  continueOnError: true,
  validate: true,
};

/** Known PO entry flags */
const KNOWN_FLAGS: Set<string> = new Set([
  'fuzzy', 'c-format', 'no-c-format', 'php-format', 'no-php-format',
  'python-format', 'no-python-format', 'java-format', 'no-java-format',
  'objc-format', 'no-objc-format', 'sh-format', 'no-sh-format',
  'qt-format', 'no-qt-format', 'kde-format', 'no-kde-format',
]);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique ID for a PO entry based on context + msgid
 */
function generateEntryId(entry: Partial<POEntry>, index: number): string {
  const base = entry.msgctxt 
    ? `${entry.msgctxt}\x04${entry.msgid}` 
    : entry.msgid || '';
  return `${index}-${hashString(base)}`;
}

/**
 * Simple string hash for ID generation
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normalize line endings to LF
 */
function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Strip UTF-8 BOM if present
 */
function stripBOM(content: string): string {
  return content.startsWith(UTF8_BOM) ? content.slice(1) : content;
}

/**
 * Create a parse issue
 */
function createIssue(
  severity: 'error' | 'warning',
  code: ParseErrorCode,
  message: string,
  line?: number
): ParseIssue {
  return { severity, code, message, line };
}

/**
 * Unescape a PO string (handle \n, \t, \", \\)
 */
function unescapeString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

/**
 * Extract string content from a quoted PO string
 * Returns null if the string is malformed
 */
function extractQuotedString(str: string): { value: string; valid: boolean } {
  const trimmed = str.trim();
  
  if (!trimmed.startsWith('"')) {
    return { value: trimmed, valid: false };
  }
  
  // Find the closing quote (handle escaped quotes)
  let i = 1;
  let result = '';
  let escaped = false;
  
  while (i < trimmed.length) {
    const char = trimmed[i];
    
    if (escaped) {
      // Handle escape sequences
      switch (char) {
        case 'n': result += '\n'; break;
        case 't': result += '\t'; break;
        case 'r': result += '\r'; break;
        case '"': result += '"'; break;
        case '\\': result += '\\'; break;
        default: result += '\\' + char; // Keep unknown escapes
      }
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      // Found closing quote
      return { value: result, valid: true };
    } else {
      result += char;
    }
    i++;
  }
  
  // No closing quote found
  return { value: result, valid: false };
}

// ============================================================================
// Header Parsing
// ============================================================================

/**
 * Parse PO file header from the first entry's msgstr
 */
function parseHeader(headerStr: string): POHeader {
  const header: POHeader = {};
  
  // Header uses literal \n in the string, not actual newlines
  // But after unescaping, we have actual newlines
  const lines = headerStr.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      
      // Convert header key to camelCase for JS access
      const camelKey = key
        .toLowerCase()
        .replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());
      
      header[camelKey] = value;
    }
  }
  
  return header;
}

/**
 * Extract nplurals from Plural-Forms header
 */
function extractNplurals(pluralForms?: string): number | undefined {
  if (!pluralForms) return undefined;
  
  const match = pluralForms.match(/nplurals\s*=\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : undefined;
}

// ============================================================================
// Entry Parsing
// ============================================================================

interface RawEntry {
  lines: string[];
  startLine: number;
}

/**
 * Split content into raw entry blocks
 */
function splitIntoBlocks(content: string): RawEntry[] {
  const lines = content.split('\n');
  const blocks: RawEntry[] = [];
  
  let currentBlock: string[] = [];
  let blockStartLine = 1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // Skip completely empty lines between blocks
    if (!line.trim()) {
      if (currentBlock.length > 0) {
        blocks.push({ lines: currentBlock, startLine: blockStartLine });
        currentBlock = [];
      }
      continue;
    }
    
    // Start new block if needed
    if (currentBlock.length === 0) {
      blockStartLine = lineNum;
    }
    
    currentBlock.push(line);
  }
  
  // Don't forget the last block
  if (currentBlock.length > 0) {
    blocks.push({ lines: currentBlock, startLine: blockStartLine });
  }
  
  return blocks;
}

/**
 * Parse a single entry block into a POEntry
 */
function parseEntryBlock(
  block: RawEntry
): { entry: POEntry | null; issues: ParseIssue[] } {
  const issues: ParseIssue[] = [];
  const { lines, startLine } = block;
  
  const entry: POEntry = {
    id: '',
    lineNumber: startLine,
    translatorComments: [],
    extractedComments: [],
    references: [],
    flags: [],
    msgid: '',
    msgstr: '',
  };
  
  let currentKey: 'msgid' | 'msgstr' | 'msgctxt' | 'msgidPlural' | null = null;
  let currentPluralIndex: number | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = startLine + i;
    
    // Empty line within block (shouldn't happen after splitting, but be safe)
    if (!line.trim()) continue;
    
    // Translator comments: "# " or just "#" (but not #. #: #, #|)
    if (line.startsWith('#') && !line.startsWith('#.') && !line.startsWith('#:') && 
        !line.startsWith('#,') && !line.startsWith('#|') && !line.startsWith('#~')) {
      const comment = line.startsWith('# ') ? line.substring(2) : 
                      line === '#' ? '' : line.substring(1);
      entry.translatorComments.push(comment);
    }
    // Extracted comments: "#."
    else if (line.startsWith('#.')) {
      entry.extractedComments.push(line.substring(2).trim());
    }
    // References: "#:"
    else if (line.startsWith('#:')) {
      // References can contain multiple space-separated references
      const refs = line.substring(2).trim().split(/\s+/);
      entry.references.push(...refs.filter(r => r));
    }
    // Flags: "#,"
    else if (line.startsWith('#,')) {
      const flagStr = line.substring(2).trim();
      const flags = flagStr.split(',').map(f => f.trim()).filter(f => f);
      
      for (const flag of flags) {
        // Accept known flags, warn about unknown ones
        if (KNOWN_FLAGS.has(flag)) {
          entry.flags.push(flag as POEntryFlag);
        } else {
          // Still add it, but as a generic flag
          entry.flags.push(flag as POEntryFlag);
        }
      }
    }
    // Previous msgid/msgctxt: "#|"
    else if (line.startsWith('#|')) {
      const content = line.substring(2).trim();
      if (content.startsWith('msgid ')) {
        const { value } = extractQuotedString(content.substring(6));
        entry.previousMsgid = value;
      } else if (content.startsWith('msgctxt ')) {
        const { value } = extractQuotedString(content.substring(8));
        entry.previousMsgctxt = value;
      }
    }
    // Obsolete entries: "#~" - skip for now
    else if (line.startsWith('#~')) {
      // Skip obsolete entries
      continue;
    }
    // msgctxt
    else if (line.startsWith('msgctxt ')) {
      currentKey = 'msgctxt';
      currentPluralIndex = null;
      const { value, valid } = extractQuotedString(line.substring(8));
      if (!valid) {
        issues.push(createIssue('error', 'UNCLOSED_QUOTE', 
          `Unclosed quote in msgctxt`, lineNum));
      }
      entry.msgctxt = value;
    }
    // msgid
    else if (line.startsWith('msgid ')) {
      currentKey = 'msgid';
      currentPluralIndex = null;
      const { value, valid } = extractQuotedString(line.substring(6));
      if (!valid) {
        issues.push(createIssue('error', 'UNCLOSED_QUOTE', 
          `Unclosed quote in msgid`, lineNum));
      }
      entry.msgid = value;
    }
    // msgid_plural
    else if (line.startsWith('msgid_plural ')) {
      currentKey = 'msgidPlural';
      currentPluralIndex = null;
      const { value, valid } = extractQuotedString(line.substring(13));
      if (!valid) {
        issues.push(createIssue('error', 'UNCLOSED_QUOTE', 
          `Unclosed quote in msgid_plural`, lineNum));
      }
      entry.msgidPlural = value;
    }
    // msgstr[n] for plurals
    else if (line.match(/^msgstr\[\d+\]\s/)) {
      const match = line.match(/^msgstr\[(\d+)\]\s(.*)$/);
      if (match) {
        currentKey = 'msgstr';
        currentPluralIndex = parseInt(match[1], 10);
        const { value, valid } = extractQuotedString(match[2]);
        if (!valid) {
          issues.push(createIssue('error', 'UNCLOSED_QUOTE', 
            `Unclosed quote in msgstr[${currentPluralIndex}]`, lineNum));
        }
        if (!entry.msgstrPlural) entry.msgstrPlural = [];
        entry.msgstrPlural[currentPluralIndex] = value;
      }
    }
    // msgstr (singular)
    else if (line.startsWith('msgstr ')) {
      currentKey = 'msgstr';
      currentPluralIndex = null;
      const { value, valid } = extractQuotedString(line.substring(7));
      if (!valid) {
        issues.push(createIssue('error', 'UNCLOSED_QUOTE', 
          `Unclosed quote in msgstr`, lineNum));
      }
      entry.msgstr = value;
    }
    // Continuation line (starts with ")
    else if (line.trimStart().startsWith('"')) {
      const { value, valid } = extractQuotedString(line.trim());
      if (!valid) {
        issues.push(createIssue('error', 'UNCLOSED_QUOTE', 
          `Unclosed quote in continuation line`, lineNum));
      }
      
      if (currentKey === 'msgctxt') {
        entry.msgctxt = (entry.msgctxt || '') + value;
      } else if (currentKey === 'msgidPlural') {
        entry.msgidPlural = (entry.msgidPlural || '') + value;
      } else if (currentKey === 'msgid') {
        entry.msgid = (entry.msgid || '') + value;
      } else if (currentKey === 'msgstr') {
        if (currentPluralIndex !== null) {
          if (!entry.msgstrPlural) entry.msgstrPlural = [];
          entry.msgstrPlural[currentPluralIndex] = 
            (entry.msgstrPlural[currentPluralIndex] || '') + value;
        } else {
          entry.msgstr = (entry.msgstr || '') + value;
        }
      }
    }
    // Unknown line
    else {
      issues.push(createIssue('warning', 'INVALID_SYNTAX', 
        `Unrecognized line format: "${line.substring(0, 30)}..."`, lineNum));
    }
  }
  
  // Validate entry has required fields
  if (entry.msgid === undefined) {
    issues.push(createIssue('error', 'MISSING_MSGID', 
      `Entry is missing msgid`, startLine));
    return { entry: null, issues };
  }
  
  // Check for missing msgstr (but allow empty msgstr for untranslated)
  if (entry.msgstr === undefined && !entry.msgstrPlural) {
    issues.push(createIssue('warning', 'MISSING_MSGSTR', 
      `Entry has msgid but no msgstr`, startLine));
    entry.msgstr = '';
  }
  
  return { entry, issues };
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse a .po file content string into a POFile structure
 * 
 * @param content - Raw .po file content
 * @param filename - Original filename
 * @param options - Parse options
 * @returns Parse result with file, errors, and warnings
 */
export function parsePOFile(
  content: string, 
  filename: string,
  options: ParseOptions = {}
): POFile {
  const result = parsePOFileWithDiagnostics(content, filename, options);
  
  if (!result.success || !result.file) {
    const errorMessages = result.errors.map(e => 
      e.line ? `Line ${e.line}: ${e.message}` : e.message
    ).join('\n');
    throw new Error(errorMessages || 'Failed to parse PO file');
  }
  
  return result.file;
}

/**
 * Parse a .po file with full diagnostics
 * 
 * @param content - Raw .po file content
 * @param filename - Original filename  
 * @param options - Parse options
 * @returns Detailed parse result with diagnostics
 */
export function parsePOFileWithDiagnostics(
  content: string,
  filename: string,
  options: ParseOptions = {}
): ParseResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: ParseIssue[] = [];
  const warnings: ParseIssue[] = [];
  
  // Initialize stats
  const stats = {
    totalEntries: 0,
    skippedEntries: 0,
    translatedEntries: 0,
    fuzzyEntries: 0,
    untranslatedEntries: 0,
  };
  
  // Handle empty input
  if (!content || !content.trim()) {
    errors.push(createIssue('error', 'EMPTY_FILE', 'The file is empty'));
    return { success: false, errors, warnings, stats };
  }
  
  // Preprocess content
  let processed = stripBOM(content);
  processed = normalizeLineEndings(processed);
  
  // Split into blocks
  const blocks = splitIntoBlocks(processed);
  
  if (blocks.length === 0) {
    errors.push(createIssue('error', 'NO_ENTRIES', 'No translation entries found'));
    return { success: false, errors, warnings, stats };
  }
  
  // Parse entries
  const entries: POEntry[] = [];
  let header: POHeader = {};
  let rawHeader: string | undefined;
  let headerFound = false;
  const seenMsgids = new Map<string, number>(); // For duplicate detection
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const { entry, issues } = parseEntryBlock(block);
    
    // Collect issues
    for (const issue of issues) {
      if (issue.severity === 'error') {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    }
    
    // Skip if entry couldn't be parsed
    if (!entry) {
      stats.skippedEntries++;
      if (!opts.continueOnError) {
        return { success: false, errors, warnings, stats };
      }
      continue;
    }
    
    // First entry with empty msgid is the header
    if (!headerFound && entry.msgid === '') {
      header = parseHeader(entry.msgstr);
      rawHeader = entry.msgstr;
      headerFound = true;
      continue;
    }
    
    // Check for duplicates (msgctxt + msgid must be unique)
    const uniqueKey = entry.msgctxt ? `${entry.msgctxt}\x04${entry.msgid}` : entry.msgid;
    const firstOccurrence = seenMsgids.get(uniqueKey);
    if (firstOccurrence !== undefined) {
      warnings.push(createIssue('warning', 'DUPLICATE_ENTRY',
        `Duplicate entry for "${entry.msgid.substring(0, 30)}${entry.msgid.length > 30 ? '...' : ''}" (first at line ${firstOccurrence})`,
        entry.lineNumber
      ));
    } else {
      seenMsgids.set(uniqueKey, entry.lineNumber || 0);
    }
    
    // Generate ID
    if (opts.generateIds) {
      entry.id = generateEntryId(entry, entries.length);
    }
    
    entries.push(entry);
    stats.totalEntries++;
    
    // Count stats
    if (entry.flags.includes('fuzzy')) {
      stats.fuzzyEntries++;
    } else if (entry.msgstr.trim() || (entry.msgstrPlural && entry.msgstrPlural.some(s => s?.trim()))) {
      stats.translatedEntries++;
    } else {
      stats.untranslatedEntries++;
    }
  }
  
  // Check if we have any entries
  if (entries.length === 0) {
    errors.push(createIssue('error', 'NO_ENTRIES', 'No translation entries found (only header present)'));
    return { success: false, errors, warnings, stats };
  }
  
  // Build the file object
  const file: POFile = {
    filename,
    header,
    rawHeader,
    entries,
    charset: header.contentType?.includes('UTF-8') ? 'UTF-8' : 'UTF-8',
    nplurals: extractNplurals(header.pluralForms),
  };
  
  // Determine success (no errors, warnings are OK)
  const success = errors.length === 0;
  
  return {
    success,
    file: success || entries.length > 0 ? file : undefined,
    errors,
    warnings,
    stats,
  };
}

/**
 * Validate PO file content without fully parsing
 * 
 * @param content - Raw .po file content
 * @returns Validation result with issues
 */
export function validatePOFile(content: string): ValidationResult {
  const result = parsePOFileWithDiagnostics(content, 'validation.po', {
    generateIds: false,
    continueOnError: true,
    validate: true,
  });
  
  return {
    valid: result.success,
    issues: [...result.errors, ...result.warnings],
  };
}

/**
 * Quick check if content looks like a valid PO file
 */
export function isPOFileContent(content: string): boolean {
  const trimmed = content.trim();
  return (
    trimmed.includes('msgid ') && 
    trimmed.includes('msgstr ') &&
    (trimmed.includes('"') || trimmed.includes("'"))
  );
}
