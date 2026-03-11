import { describe, expect, it } from 'vitest';
import { analyzeQaForEntries, summarizeQaReports } from '@/lib/qa';
import type { POEntry } from '@/lib/po';

function makeEntry(id: string, overrides: Partial<POEntry> = {}): POEntry {
  return {
    id,
    translatorComments: [],
    extractedComments: [],
    references: [],
    flags: [],
    msgid: 'Save %s',
    msgstr: 'Opslaan',
    ...overrides,
  };
}

describe('qa analyzer', () => {
  it('flags placeholder and punctuation drift errors', () => {
    const reports = analyzeQaForEntries([makeEntry('a', { msgid: 'Save %s.', msgstr: 'Opslaan' })], new Map());
    const report = reports.get('a');

    expect(report?.issues.some((issue) => issue.ruleId === 'placeholder-parity')).toBe(true);
    expect(report?.issues.some((issue) => issue.ruleId === 'punctuation-drift')).toBe(true);
  });

  it('flags repeated-source inconsistencies across approved entries', () => {
    const reports = analyzeQaForEntries(
      [
        makeEntry('a', { msgid: 'Close', msgstr: 'Sluiten' }),
        makeEntry('b', { msgid: 'Close', msgstr: 'Dicht' }),
      ],
      new Map(),
    );

    expect(reports.get('a')?.issues.some((issue) => issue.ruleId === 'repeated-source-consistency')).toBe(true);
    expect(reports.get('b')?.issues.some((issue) => issue.ruleId === 'repeated-source-consistency')).toBe(true);
  });

  it('summarizes report counts', () => {
    const reports = analyzeQaForEntries([makeEntry('a', { msgid: 'Hello', msgstr: ' Hello ' })], new Map());
    const summary = summarizeQaReports(reports);

    expect(summary.entriesWithIssues).toBe(1);
    expect(summary.totalIssues).toBeGreaterThan(0);
  });
});
