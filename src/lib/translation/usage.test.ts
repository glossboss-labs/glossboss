import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTranslationUsage, recordTranslationUsage, resetTranslationUsage } from './usage';

describe('translation usage tracking', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns zero counts for a fresh provider', () => {
    const usage = getTranslationUsage('azure');
    expect(usage.characterCount).toBe(0);
    expect(usage.translationCount).toBe(0);
    expect(usage.periodStartedAt).toBe(0);
  });

  it('records characters for a provider', () => {
    recordTranslationUsage('azure', 100);
    const usage = getTranslationUsage('azure');
    expect(usage.characterCount).toBe(100);
    expect(usage.translationCount).toBe(1);
    expect(usage.periodStartedAt).toBeGreaterThan(0);
  });

  it('accumulates characters across multiple recordings', () => {
    recordTranslationUsage('gemini', 50);
    recordTranslationUsage('gemini', 75);
    recordTranslationUsage('gemini', 25);
    const usage = getTranslationUsage('gemini');
    expect(usage.characterCount).toBe(150);
    expect(usage.translationCount).toBe(3);
  });

  it('tracks providers independently', () => {
    recordTranslationUsage('azure', 200);
    recordTranslationUsage('gemini', 300);
    recordTranslationUsage('deepl', 400);

    expect(getTranslationUsage('azure').characterCount).toBe(200);
    expect(getTranslationUsage('gemini').characterCount).toBe(300);
    expect(getTranslationUsage('deepl').characterCount).toBe(400);
  });

  it('resets usage for a specific provider without affecting others', () => {
    recordTranslationUsage('azure', 100);
    recordTranslationUsage('gemini', 200);

    resetTranslationUsage('azure');

    expect(getTranslationUsage('azure').characterCount).toBe(0);
    expect(getTranslationUsage('gemini').characterCount).toBe(200);
  });

  it('ignores zero or negative character counts', () => {
    recordTranslationUsage('azure', 0);
    recordTranslationUsage('azure', -10);
    const usage = getTranslationUsage('azure');
    expect(usage.characterCount).toBe(0);
    expect(usage.translationCount).toBe(0);
  });

  it('handles corrupted storage gracefully', () => {
    window.localStorage.setItem('glossboss-translation-usage', 'not-json');
    const usage = getTranslationUsage('azure');
    expect(usage.characterCount).toBe(0);
  });

  it('preserves periodStartedAt across recordings', () => {
    recordTranslationUsage('azure', 50);
    const first = getTranslationUsage('azure').periodStartedAt;

    recordTranslationUsage('azure', 50);
    const second = getTranslationUsage('azure').periodStartedAt;

    expect(second).toBe(first);
  });
});
