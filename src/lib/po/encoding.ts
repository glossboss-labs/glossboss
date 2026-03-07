/**
 * PO File Encoding Detection & Conversion
 * 
 * Handles detection and conversion of various character encodings
 * commonly found in PO files (ISO-8859-1, Windows-1252, UTF-8, etc.)
 * 
 * Uses the browser's TextDecoder API for conversion.
 */

// ============================================================================
// Types
// ============================================================================

/** Supported encodings that TextDecoder can handle */
export type SupportedEncoding = 
  | 'utf-8'
  | 'utf-16le'
  | 'utf-16be'
  | 'iso-8859-1'    // Latin-1
  | 'iso-8859-2'    // Latin-2 (Central European)
  | 'iso-8859-15'   // Latin-9 (Western European with Euro)
  | 'windows-1250'  // Central European
  | 'windows-1251'  // Cyrillic
  | 'windows-1252'  // Western European
  | 'windows-1256'  // Arabic
  | 'koi8-r'        // Russian
  | 'koi8-u'        // Ukrainian
  | 'gb18030'       // Chinese
  | 'big5'          // Traditional Chinese
  | 'euc-jp'        // Japanese
  | 'iso-2022-jp'   // Japanese
  | 'shift_jis'     // Japanese
  | 'euc-kr';       // Korean

/** Result of encoding detection */
export interface EncodingDetectionResult {
  /** Detected encoding */
  encoding: SupportedEncoding;
  /** Confidence level */
  confidence: 'certain' | 'high' | 'medium' | 'low';
  /** How the encoding was detected */
  method: 'bom' | 'header' | 'heuristic' | 'default';
  /** The decoded string content */
  content: string;
}

/** Common encoding aliases mapped to standard names */
const ENCODING_ALIASES: Record<string, SupportedEncoding> = {
  // UTF-8
  'utf8': 'utf-8',
  'utf-8': 'utf-8',
  
  // UTF-16
  'utf16le': 'utf-16le',
  'utf-16le': 'utf-16le',
  'utf16be': 'utf-16be',
  'utf-16be': 'utf-16be',
  'ucs-2': 'utf-16le',
  
  // ISO-8859 family
  'iso-8859-1': 'iso-8859-1',
  'iso8859-1': 'iso-8859-1',
  'iso88591': 'iso-8859-1',
  'latin1': 'iso-8859-1',
  'latin-1': 'iso-8859-1',
  'iso-8859-2': 'iso-8859-2',
  'latin2': 'iso-8859-2',
  'iso-8859-15': 'iso-8859-15',
  'latin9': 'iso-8859-15',
  
  // Windows code pages
  'windows-1250': 'windows-1250',
  'cp1250': 'windows-1250',
  'windows-1251': 'windows-1251',
  'cp1251': 'windows-1251',
  'windows-1252': 'windows-1252',
  'cp1252': 'windows-1252',
  'windows-1256': 'windows-1256',
  'cp1256': 'windows-1256',
  
  // Cyrillic
  'koi8-r': 'koi8-r',
  'koi8r': 'koi8-r',
  'koi8-u': 'koi8-u',
  'koi8u': 'koi8-u',
  
  // Chinese
  'gb18030': 'gb18030',
  'gbk': 'gb18030',
  'gb2312': 'gb18030',
  'big5': 'big5',
  'big5-hkscs': 'big5',
  
  // Japanese
  'euc-jp': 'euc-jp',
  'eucjp': 'euc-jp',
  'iso-2022-jp': 'iso-2022-jp',
  'shift_jis': 'shift_jis',
  'shiftjis': 'shift_jis',
  'sjis': 'shift_jis',
  
  // Korean
  'euc-kr': 'euc-kr',
  'euckr': 'euc-kr',
  'korean': 'euc-kr',
};

// ============================================================================
// BOM Detection
// ============================================================================

/** Byte Order Mark signatures */
const BOM_SIGNATURES: Array<{ bom: number[]; encoding: SupportedEncoding }> = [
  { bom: [0xEF, 0xBB, 0xBF], encoding: 'utf-8' },
  { bom: [0xFF, 0xFE], encoding: 'utf-16le' },
  { bom: [0xFE, 0xFF], encoding: 'utf-16be' },
];

/**
 * Detect encoding from BOM (Byte Order Mark)
 */
function detectBOM(bytes: Uint8Array): { encoding: SupportedEncoding; bomLength: number } | null {
  for (const { bom, encoding } of BOM_SIGNATURES) {
    if (bytes.length >= bom.length) {
      let matches = true;
      for (let i = 0; i < bom.length; i++) {
        if (bytes[i] !== bom[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return { encoding, bomLength: bom.length };
      }
    }
  }
  return null;
}

// ============================================================================
// Header-based Detection
// ============================================================================

/**
 * Try to extract charset from Content-Type header in raw bytes
 * PO files have the charset in the header: "Content-Type: text/plain; charset=UTF-8\n"
 */
function detectFromHeader(bytes: Uint8Array): SupportedEncoding | null {
  // First, decode as ASCII (safe for header detection)
  // Content-Type header uses ASCII characters
  let asciiPreview = '';
  const previewLength = Math.min(bytes.length, 2000); // Check first 2KB
  
  for (let i = 0; i < previewLength; i++) {
    const byte = bytes[i];
    // Only include printable ASCII and common whitespace
    if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
      asciiPreview += String.fromCharCode(byte);
    }
  }
  
  // Look for charset in Content-Type
  const charsetMatch = asciiPreview.match(/[Cc]ontent-[Tt]ype:[^\n]*charset=([^\s\\"]+)/i);
  if (charsetMatch) {
    const charset = charsetMatch[1].toLowerCase().replace(/["']/g, '');
    return normalizeEncoding(charset);
  }
  
  return null;
}

/**
 * Normalize encoding name to a supported encoding
 */
export function normalizeEncoding(encoding: string): SupportedEncoding | null {
  const normalized = encoding.toLowerCase().trim();
  return ENCODING_ALIASES[normalized] || null;
}

// ============================================================================
// Heuristic Detection
// ============================================================================

/**
 * Use heuristics to guess encoding based on byte patterns
 */
function detectByHeuristics(bytes: Uint8Array): SupportedEncoding {
  // Check for valid UTF-8 sequences
  if (isValidUtf8(bytes)) {
    return 'utf-8';
  }
  
  // Check for high-byte patterns common in different encodings
  const highByteStats = analyzeHighBytes(bytes);
  
  // If many bytes in 0x80-0x9F range, likely Windows-1252 (not ISO-8859-1)
  if (highByteStats.windows1252Likely > highByteStats.iso8859Likely) {
    return 'windows-1252';
  }
  
  // Default to ISO-8859-1 for Western European
  return 'iso-8859-1';
}

/**
 * Check if bytes form valid UTF-8 sequences
 */
function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  let nonAsciiCount = 0;
  let invalidCount = 0;
  
  while (i < bytes.length) {
    const byte = bytes[i];
    
    if (byte < 0x80) {
      // ASCII
      i++;
    } else if (byte >= 0xC2 && byte <= 0xDF) {
      // 2-byte sequence
      nonAsciiCount++;
      if (i + 1 >= bytes.length || (bytes[i + 1] & 0xC0) !== 0x80) {
        invalidCount++;
        i++;
      } else {
        i += 2;
      }
    } else if (byte >= 0xE0 && byte <= 0xEF) {
      // 3-byte sequence
      nonAsciiCount++;
      if (i + 2 >= bytes.length || 
          (bytes[i + 1] & 0xC0) !== 0x80 || 
          (bytes[i + 2] & 0xC0) !== 0x80) {
        invalidCount++;
        i++;
      } else {
        i += 3;
      }
    } else if (byte >= 0xF0 && byte <= 0xF4) {
      // 4-byte sequence
      nonAsciiCount++;
      if (i + 3 >= bytes.length || 
          (bytes[i + 1] & 0xC0) !== 0x80 || 
          (bytes[i + 2] & 0xC0) !== 0x80 ||
          (bytes[i + 3] & 0xC0) !== 0x80) {
        invalidCount++;
        i++;
      } else {
        i += 4;
      }
    } else if (byte >= 0x80) {
      // Invalid UTF-8 start byte
      invalidCount++;
      i++;
    } else {
      i++;
    }
  }
  
  // If we found non-ASCII and few/no invalid sequences, it's likely UTF-8
  // Allow some tolerance for potentially corrupted files
  if (nonAsciiCount > 0) {
    return invalidCount < nonAsciiCount * 0.1; // Less than 10% invalid
  }
  
  // Pure ASCII is valid UTF-8
  return true;
}

/**
 * Analyze high-byte patterns to distinguish between encodings
 */
function analyzeHighBytes(bytes: Uint8Array): {
  windows1252Likely: number;
  iso8859Likely: number;
} {
  let windows1252Count = 0;
  let iso8859Count = 0;
  
  for (const byte of bytes) {
    // Bytes 0x80-0x9F are control characters in ISO-8859-1
    // but printable characters in Windows-1252
    if (byte >= 0x80 && byte <= 0x9F) {
      windows1252Count++;
    } else if (byte >= 0xA0 && byte <= 0xFF) {
      iso8859Count++;
    }
  }
  
  return {
    windows1252Likely: windows1252Count,
    iso8859Likely: iso8859Count,
  };
}

// ============================================================================
// Main Detection & Conversion
// ============================================================================

/**
 * Detect encoding and decode file content
 * 
 * @param buffer - Raw file content as ArrayBuffer
 * @returns Detection result with decoded content
 */
export function detectAndDecode(buffer: ArrayBuffer): EncodingDetectionResult {
  const bytes = new Uint8Array(buffer);
  
  // 1. Try BOM detection first (most reliable)
  const bomResult = detectBOM(bytes);
  if (bomResult) {
    const content = decodeWithEncoding(
      bytes.slice(bomResult.bomLength), 
      bomResult.encoding
    );
    return {
      encoding: bomResult.encoding,
      confidence: 'certain',
      method: 'bom',
      content,
    };
  }
  
  // 2. Try header-based detection
  const headerEncoding = detectFromHeader(bytes);
  if (headerEncoding) {
    try {
      const content = decodeWithEncoding(bytes, headerEncoding);
      return {
        encoding: headerEncoding,
        confidence: 'high',
        method: 'header',
        content,
      };
    } catch {
      // Header might be wrong, fall through to heuristics
    }
  }
  
  // 3. Use heuristics
  const heuristicEncoding = detectByHeuristics(bytes);
  const content = decodeWithEncoding(bytes, heuristicEncoding);
  
  return {
    encoding: heuristicEncoding,
    confidence: heuristicEncoding === 'utf-8' ? 'high' : 'medium',
    method: 'heuristic',
    content,
  };
}

/**
 * Decode bytes with a specific encoding
 */
export function decodeWithEncoding(
  bytes: Uint8Array, 
  encoding: SupportedEncoding
): string {
  try {
    const decoder = new TextDecoder(encoding, { fatal: false });
    return decoder.decode(bytes);
  } catch {
    // Fallback to UTF-8 if encoding not supported
    console.warn(`Encoding ${encoding} not supported, falling back to UTF-8`);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    return decoder.decode(bytes);
  }
}

/**
 * Check if an encoding is supported by the browser
 */
export function isEncodingSupported(encoding: string): boolean {
  try {
    new TextDecoder(encoding);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a list of all supported encodings
 */
export function getSupportedEncodings(): string[] {
  return Object.keys(ENCODING_ALIASES).filter(isEncodingSupported);
}

/**
 * Convert string from one encoding to another
 * (Useful for re-encoding when saving)
 */
export function encodeToBytes(
  content: string, 
  encoding: SupportedEncoding = 'utf-8'
): Uint8Array {
  // TextEncoder only supports UTF-8
  // For other encodings, we need to do manual conversion
  
  if (encoding === 'utf-8') {
    const encoder = new TextEncoder();
    return encoder.encode(content);
  }
  
  // For non-UTF-8, we'll encode as UTF-8 and let the user know
  // Full encoding support would require a library like iconv-lite
  console.warn(`Encoding to ${encoding} not fully supported, using UTF-8`);
  const encoder = new TextEncoder();
  return encoder.encode(content);
}
