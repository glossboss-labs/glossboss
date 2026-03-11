import { describe, expect, it } from 'vitest';
import { maskPlaceholders, unmaskPlaceholders, hasPlaceholders } from './placeholder-mask';

describe('placeholder-mask', () => {
  describe('maskPlaceholders', () => {
    it('masks printf-style placeholders', () => {
      const result = maskPlaceholders('Uploaded %d file(s) to %s');
      expect(result.text).toBe('Uploaded <m id="0" /> file(s) to <m id="1" />');
      expect(result.tokens.get(0)).toBe('%d');
      expect(result.tokens.get(1)).toBe('%s');
    });

    it('masks positional printf placeholders', () => {
      const result = maskPlaceholders('%1$s has %2$d items');
      expect(result.text).toBe('<m id="0" /> has <m id="1" /> items');
      expect(result.tokens.get(0)).toBe('%1$s');
      expect(result.tokens.get(1)).toBe('%2$d');
    });

    it('masks escaped percent literal', () => {
      const result = maskPlaceholders('100%% complete');
      expect(result.text).toBe('100<m id="0" /> complete');
      expect(result.tokens.get(0)).toBe('%%');
    });

    it('masks ICU variables', () => {
      const result = maskPlaceholders('{count} items remaining for {name}');
      expect(result.text).toBe('<m id="0" /> items remaining for <m id="1" />');
      expect(result.tokens.get(0)).toBe('{count}');
      expect(result.tokens.get(1)).toBe('{name}');
    });

    it('masks ICU variables with simple format specifiers', () => {
      const result = maskPlaceholders('You have {count,number} items');
      expect(result.text).toBe('You have <m id="0" /> items');
      expect(result.tokens.get(0)).toBe('{count,number}');
    });

    it('preserves plain text without placeholders', () => {
      const result = maskPlaceholders('Hello world');
      expect(result.text).toBe('Hello world');
      expect(result.tokens.size).toBe(0);
    });

    it('leaves HTML tags alone (handled by DeepL XML mode)', () => {
      const result = maskPlaceholders('Click <a>here</a>');
      expect(result.text).toBe('Click <a>here</a>');
      expect(result.tokens.size).toBe(0);
    });

    it('handles mixed placeholders and HTML', () => {
      const result = maskPlaceholders('<b>%d</b> items for {name}');
      expect(result.text).toBe('<b><m id="0" /></b> items for <m id="1" />');
      expect(result.tokens.get(0)).toBe('%d');
      expect(result.tokens.get(1)).toBe('{name}');
    });
  });

  describe('unmaskPlaceholders', () => {
    it('restores masked placeholders in translated text', () => {
      const tokens = new Map([
        [0, '%d'],
        [1, '%s'],
      ]);
      const result = unmaskPlaceholders(
        '<m id="0" /> Dateien nach <m id="1" /> hochgeladen',
        tokens,
      );
      expect(result).toBe('%d Dateien nach %s hochgeladen');
    });

    it('handles text without tokens', () => {
      expect(unmaskPlaceholders('No tokens here', new Map())).toBe('No tokens here');
    });

    it('round-trips correctly', () => {
      const original = 'Hello %s, you have %d items in {folder}';
      const masked = maskPlaceholders(original);
      // Simulate DeepL translating the non-placeholder parts
      const translated = masked.text
        .replace('Hello', 'Hallo')
        .replace('you have', 'je hebt')
        .replace('items in', 'items in');
      const restored = unmaskPlaceholders(translated, masked.tokens);
      expect(restored).toBe('Hallo %s, je hebt %d items in {folder}');
    });
  });

  describe('hasPlaceholders', () => {
    it('returns true for printf placeholders', () => {
      expect(hasPlaceholders('Hello %s')).toBe(true);
    });

    it('returns true for ICU variables', () => {
      expect(hasPlaceholders('{count} items')).toBe(true);
    });

    it('returns false for plain text', () => {
      expect(hasPlaceholders('Hello world')).toBe(false);
    });

    it('returns false for HTML tags', () => {
      expect(hasPlaceholders('<b>bold</b>')).toBe(false);
    });
  });
});
