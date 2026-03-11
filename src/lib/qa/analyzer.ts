import type { POEntry } from '@/lib/po';
import type { GlossaryAnalysisResult } from '@/lib/glossary';
import type { QAEntryReport, QAIssue, QASummary } from './types';

const RULE_IDS = [
  'placeholder-parity',
  'html-tag-parity',
  'icu-variable-parity',
  'glossary-conflict',
  'repeated-source-consistency',
  'whitespace-drift',
  'punctuation-drift',
] as const;

function createEmptyReport(entryId: string): QAEntryReport {
  return {
    entryId,
    issues: [],
    errorCount: 0,
    warningCount: 0,
    analyzedAt: new Date().toISOString(),
  };
}

function addIssue(report: QAEntryReport, issue: QAIssue): void {
  report.issues.push(issue);
  if (issue.severity === 'error') {
    report.errorCount += 1;
  } else {
    report.warningCount += 1;
  }
}

function getSourceText(entry: POEntry): string {
  return entry.msgidPlural ? `${entry.msgid}\n${entry.msgidPlural}` : entry.msgid;
}

function getTargetText(entry: POEntry): string {
  return entry.msgidPlural ? (entry.msgstrPlural ?? []).join('\n') : entry.msgstr;
}

function collectMultiset(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function sameMultiset(left: string[], right: string[]): boolean {
  const leftCounts = collectMultiset(left);
  const rightCounts = collectMultiset(right);
  if (leftCounts.size !== rightCounts.size) return false;

  for (const [value, count] of leftCounts) {
    if ((rightCounts.get(value) ?? 0) !== count) return false;
  }

  return true;
}

function extractPlaceholders(value: string): string[] {
  return Array.from(value.matchAll(/%(?:\d+\$)?[#+\-0 ]?(?:\d+)?(?:\.\d+)?[bcdeEufFgGiosxX]/g)).map(
    (match) => match[0],
  );
}

function extractHtmlTags(value: string): string[] {
  return Array.from(value.matchAll(/<\/?([a-zA-Z][\w:-]*)\b[^>]*\/?>/g)).map((match) =>
    match[0].replace(/\s+/g, ' '),
  );
}

function extractIcuVariables(value: string): string[] {
  return Array.from(value.matchAll(/\{([a-zA-Z_][\w.-]*)(?:,[^{}]+)?\}/g)).map((match) => match[1]);
}

function getWhitespaceSignature(value: string): {
  leadingSpaces: number;
  trailingSpaces: number;
  leadingNewlines: number;
  trailingNewlines: number;
} {
  const leadingSpaces = value.match(/^[ \t]*/)?.[0].length ?? 0;
  const trailingSpaces = value.match(/[ \t]*$/)?.[0].length ?? 0;
  const leadingNewlines = value.match(/^\n*/)?.[0].length ?? 0;
  const trailingNewlines = value.match(/\n*$/)?.[0].length ?? 0;

  return {
    leadingSpaces,
    trailingSpaces,
    leadingNewlines,
    trailingNewlines,
  };
}

function getTerminalPunctuation(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/([.!?…:;])$/);
  return match?.[1] ?? null;
}

function analyzeEntry(entry: POEntry, glossaryAnalysis?: GlossaryAnalysisResult): QAEntryReport {
  const report = createEmptyReport(entry.id);
  const sourceText = getSourceText(entry);
  const targetText = getTargetText(entry);

  // Skip parity/drift checks for untranslated or fuzzy entries — they produce noise
  const hasTranslation = targetText.trim() !== '';
  const isFuzzy = entry.flags.includes('fuzzy');
  const shouldRunParityChecks = hasTranslation && !isFuzzy;

  if (shouldRunParityChecks) {
    const sourcePlaceholders = extractPlaceholders(sourceText);
    const targetPlaceholders = extractPlaceholders(targetText);
    if (!sameMultiset(sourcePlaceholders, targetPlaceholders)) {
      addIssue(report, {
        ruleId: 'placeholder-parity',
        severity: 'error',
        message: 'Placeholder mismatch between source and translation.',
        details: [
          `Source: ${sourcePlaceholders.join(', ') || 'none'}`,
          `Target: ${targetPlaceholders.join(', ') || 'none'}`,
        ],
      });
    }

    const sourceTags = extractHtmlTags(sourceText);
    const targetTags = extractHtmlTags(targetText);
    if (!sameMultiset(sourceTags, targetTags)) {
      addIssue(report, {
        ruleId: 'html-tag-parity',
        severity: 'error',
        message: 'HTML tag mismatch between source and translation.',
        details: [
          `Source: ${sourceTags.join(', ') || 'none'}`,
          `Target: ${targetTags.join(', ') || 'none'}`,
        ],
      });
    }

    const sourceVariables = extractIcuVariables(sourceText);
    const targetVariables = extractIcuVariables(targetText);
    if (!sameMultiset(sourceVariables, targetVariables)) {
      addIssue(report, {
        ruleId: 'icu-variable-parity',
        severity: 'error',
        message: 'ICU-style variable mismatch between source and translation.',
        details: [
          `Source: ${sourceVariables.join(', ') || 'none'}`,
          `Target: ${targetVariables.join(', ') || 'none'}`,
        ],
      });
    }

    if (glossaryAnalysis && glossaryAnalysis.needsReviewCount > 0) {
      addIssue(report, {
        ruleId: 'glossary-conflict',
        severity: 'warning',
        message: `${glossaryAnalysis.needsReviewCount} glossary term(s) need review.`,
        details: glossaryAnalysis.terms
          .filter((term) => !term.found)
          .map((term) => `${term.term} -> ${term.expectedTranslation}`),
      });
      report.glossaryAnalysis = glossaryAnalysis;
    }

    const sourceWhitespace = getWhitespaceSignature(sourceText);
    const targetWhitespace = getWhitespaceSignature(targetText);
    if (
      sourceWhitespace.leadingSpaces !== targetWhitespace.leadingSpaces ||
      sourceWhitespace.trailingSpaces !== targetWhitespace.trailingSpaces ||
      sourceWhitespace.leadingNewlines !== targetWhitespace.leadingNewlines ||
      sourceWhitespace.trailingNewlines !== targetWhitespace.trailingNewlines
    ) {
      addIssue(report, {
        ruleId: 'whitespace-drift',
        severity: 'warning',
        message: 'Leading or trailing whitespace differs from the source string.',
      });
    }

    const sourcePunctuation = getTerminalPunctuation(sourceText);
    const targetPunctuation = getTerminalPunctuation(targetText);
    if (sourcePunctuation !== targetPunctuation) {
      addIssue(report, {
        ruleId: 'punctuation-drift',
        severity: 'warning',
        message: 'Terminal punctuation differs from the source string.',
        details: [
          `Source: ${sourcePunctuation ?? 'none'}`,
          `Target: ${targetPunctuation ?? 'none'}`,
        ],
      });
    }
  }

  return report;
}

function addRepeatedSourceWarnings(entries: POEntry[], reports: Map<string, QAEntryReport>): void {
  const groups = new Map<string, POEntry[]>();

  for (const entry of entries) {
    if (!getTargetText(entry).trim() || entry.flags.includes('fuzzy')) continue;

    const groupKey = [entry.msgctxt ?? '', entry.msgid, entry.msgidPlural ?? ''].join('::');
    const group = groups.get(groupKey) ?? [];
    group.push(entry);
    groups.set(groupKey, group);
  }

  for (const group of groups.values()) {
    const normalizedTargets = new Set(group.map((entry) => getTargetText(entry).trim()));
    if (normalizedTargets.size < 2) continue;

    for (const entry of group) {
      const report = reports.get(entry.id) ?? createEmptyReport(entry.id);

      addIssue(report, {
        ruleId: 'repeated-source-consistency',
        severity: 'warning',
        message: 'Matching source strings have inconsistent approved translations.',
        details: group.map((candidate) =>
          candidate.msgidPlural ? (candidate.msgstrPlural ?? []).join(' | ') : candidate.msgstr,
        ),
      });

      reports.set(entry.id, report);
    }
  }
}

export function analyzeQaForEntries(
  entries: POEntry[],
  glossaryAnalysis: Map<string, GlossaryAnalysisResult>,
): Map<string, QAEntryReport> {
  const reports = new Map<string, QAEntryReport>();

  for (const entry of entries) {
    const report = analyzeEntry(entry, glossaryAnalysis.get(entry.id));
    if (report.issues.length > 0) {
      reports.set(entry.id, report);
    }
  }

  addRepeatedSourceWarnings(entries, reports);
  return reports;
}

export function summarizeQaReports(reports: Map<string, QAEntryReport>): QASummary {
  const byRule = Object.fromEntries(RULE_IDS.map((ruleId) => [ruleId, 0])) as QASummary['byRule'];
  let errors = 0;
  let warnings = 0;
  let totalIssues = 0;

  for (const report of reports.values()) {
    errors += report.errorCount;
    warnings += report.warningCount;
    totalIssues += report.issues.length;

    for (const issue of report.issues) {
      byRule[issue.ruleId] += 1;
    }
  }

  return {
    entriesWithIssues: reports.size,
    totalIssues,
    errors,
    warnings,
    byRule,
  };
}
