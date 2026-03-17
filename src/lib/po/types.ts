/**
 * PO File Types
 *
 * Represents the structure of GNU gettext .po files.
 * A PO file consists of a header and multiple translation entries.
 */

/** Metadata from the PO file header */
export interface POHeader {
  /** Project name and version */
  projectIdVersion?: string;
  /** Where to report translation bugs */
  reportMsgidBugsTo?: string;
  /** When the POT template was created */
  potCreationDate?: string;
  /** When the PO was last updated */
  poRevisionDate?: string;
  /** Name and email of last translator */
  lastTranslator?: string;
  /** Translation team info */
  languageTeam?: string;
  /** Target language code (e.g., 'nl', 'de') */
  language?: string;
  /** MIME version (usually 1.0) */
  mimeVersion?: string;
  /** Content type with charset */
  contentType?: string;
  /** Transfer encoding (usually 8bit) */
  contentTransferEncoding?: string;
  /** Plural forms expression */
  pluralForms?: string;
  /** POT-specific generator info */
  xGenerator?: string;
  /** Allow additional headers */
  [key: string]: string | undefined;
}

/** Flags that can be attached to a PO entry */
export type POEntryFlag =
  | 'fuzzy'
  | 'c-format'
  | 'no-c-format'
  | 'php-format'
  | 'no-php-format'
  | 'python-format'
  | 'no-python-format'
  | 'java-format'
  | 'no-java-format';

/** A single translation entry in a PO file */
export interface POEntry {
  /** Unique identifier for this entry (generated, not from file) */
  id: string;

  /** Line number where this entry starts (1-based) */
  lineNumber?: number;

  /** Translator comments (lines starting with "# ") */
  translatorComments: string[];

  /** Extracted comments from source (lines starting with "#.") */
  extractedComments: string[];

  /** Source file references (lines starting with "#:") */
  references: string[];

  /** Flags like fuzzy, c-format (lines starting with "#,") */
  flags: POEntryFlag[];

  /** Previous msgid for fuzzy entries (lines starting with "#|") */
  previousMsgid?: string;

  /** Previous msgctxt for fuzzy entries */
  previousMsgctxt?: string;

  /** Message context for disambiguation */
  msgctxt?: string;

  /** Original string (source language) */
  msgid: string;

  /** Plural form of original string */
  msgidPlural?: string;

  /** Translated string (singular or only form) */
  msgstr: string;

  /** Plural translations (msgstr[0], msgstr[1], etc.) */
  msgstrPlural?: string[];

  /**
   * Source language text resolved from an uploaded source file.
   * When present, this is the human-readable source text (e.g. "Save")
   * while msgid may contain a key (e.g. "button.save").
   */
  sourceText?: string;

  /** Plural form of source text from source file */
  sourceTextPlural?: string;

  /** Whether this entry has been modified in the editor */
  isDirty?: boolean;
}

/** Complete parsed PO file */
export interface POFile {
  /** Original filename */
  filename: string;

  /** Parsed header metadata */
  header: POHeader;

  /** Raw header string (for round-trip preservation) */
  rawHeader?: string;

  /** All translation entries */
  entries: POEntry[];

  /** Character encoding (usually UTF-8) */
  charset: string;

  /** Number of plural forms (from Plural-Forms header) */
  nplurals?: number;
}

/** Options for parsing */
export interface ParseOptions {
  /** Generate IDs for entries (default: true) */
  generateIds?: boolean;

  /** Continue parsing after errors (default: true) */
  continueOnError?: boolean;

  /** Validate entries after parsing (default: true) */
  validate?: boolean;
}

/** Options for serialization */
export interface SerializeOptions {
  /** Line ending to use (default: '\n') */
  lineEnding?: '\n' | '\r\n';

  /** Wrap long lines at this width (default: 80, 0 = no wrap) */
  wrapWidth?: number;

  /** Update PO-Revision-Date to current time (default: true) */
  updateRevisionDate?: boolean;

  /** Update Last-Translator field (default: null = don't update) */
  lastTranslator?: string | null;
}

/** Severity of a parse issue */
export type ParseIssueSeverity = 'error' | 'warning';

/** A parsing error or warning */
export interface ParseIssue {
  /** Severity level */
  severity: ParseIssueSeverity;

  /** Human-readable message */
  message: string;

  /** Line number where the issue occurred (1-based) */
  line?: number;

  /** Error code for programmatic handling */
  code: ParseErrorCode;
}

/** Error codes for parsing issues */
export type ParseErrorCode =
  | 'EMPTY_FILE'
  | 'NO_ENTRIES'
  | 'UNCLOSED_QUOTE'
  | 'MISSING_MSGSTR'
  | 'MISSING_MSGID'
  | 'DUPLICATE_ENTRY'
  | 'INVALID_SYNTAX'
  | 'INVALID_HEADER'
  | 'ENCODING_ERROR';

/** Result of parsing a PO file */
export interface ParseResult {
  /** Whether parsing succeeded (may still have warnings) */
  success: boolean;

  /** The parsed PO file (present if success or partial success) */
  file?: POFile;

  /** Errors that prevented parsing */
  errors: ParseIssue[];

  /** Warnings that didn't prevent parsing */
  warnings: ParseIssue[];

  /** Statistics about the parse */
  stats: {
    /** Total entries parsed */
    totalEntries: number;
    /** Entries that were skipped due to errors */
    skippedEntries: number;
    /** Entries with translations */
    translatedEntries: number;
    /** Entries marked fuzzy */
    fuzzyEntries: number;
    /** Entries without translations */
    untranslatedEntries: number;
  };
}

/** Validation result */
export interface ValidationResult {
  /** Whether the file is valid */
  valid: boolean;

  /** All issues found */
  issues: ParseIssue[];
}
