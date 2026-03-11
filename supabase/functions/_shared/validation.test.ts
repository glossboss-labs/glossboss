import { describe, expect, it } from 'vitest';
import { isNonEmptyString, isObject, isValidLanguageCode, trimAndLimit } from './validation';

describe('isObject', () => {
  it('returns true for plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isObject(null)).toBe(false);
  });

  it('returns false for arrays', () => {
    expect(isObject([])).toBe(false);
    expect(isObject([1, 2])).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isObject('')).toBe(false);
    expect(isObject(0)).toBe(false);
    expect(isObject(false)).toBe(false);
    expect(isObject(undefined)).toBe(false);
  });
});

describe('isNonEmptyString', () => {
  it('returns true for non-empty strings', () => {
    expect(isNonEmptyString('hello')).toBe(true);
    expect(isNonEmptyString('a')).toBe(true);
  });

  it('returns false for empty or whitespace-only strings', () => {
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString('\t\n')).toBe(false);
  });

  it('returns false for non-string values', () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString({})).toBe(false);
  });
});

describe('trimAndLimit', () => {
  it('trims whitespace and limits length', () => {
    expect(trimAndLimit('  hello  ', 10)).toBe('hello');
    expect(trimAndLimit('  hello world  ', 5)).toBe('hello');
  });

  it('returns empty string for empty input', () => {
    expect(trimAndLimit('', 100)).toBe('');
    expect(trimAndLimit('   ', 100)).toBe('');
  });

  it('truncates at maxLength after trimming', () => {
    expect(trimAndLimit('abcdef', 3)).toBe('abc');
  });
});

describe('isValidLanguageCode', () => {
  it('accepts two-letter codes', () => {
    expect(isValidLanguageCode('EN')).toBe(true);
    expect(isValidLanguageCode('de')).toBe(true);
    expect(isValidLanguageCode('nl')).toBe(true);
  });

  it('accepts three-letter codes', () => {
    expect(isValidLanguageCode('ENG')).toBe(true);
  });

  it('accepts codes with region suffix', () => {
    expect(isValidLanguageCode('EN-GB')).toBe(true);
    expect(isValidLanguageCode('pt-BR')).toBe(true);
    expect(isValidLanguageCode('zh-CN')).toBe(true);
    expect(isValidLanguageCode('PT-PT')).toBe(true);
  });

  it('rejects numeric codes', () => {
    expect(isValidLanguageCode('12')).toBe(false);
    expect(isValidLanguageCode('123')).toBe(false);
  });

  it('rejects single character codes', () => {
    expect(isValidLanguageCode('E')).toBe(false);
  });

  it('rejects codes with invalid separators', () => {
    expect(isValidLanguageCode('EN_GB')).toBe(false);
    expect(isValidLanguageCode('EN.GB')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isValidLanguageCode('')).toBe(false);
  });
});
