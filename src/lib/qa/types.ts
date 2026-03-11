import type { GlossaryAnalysisResult } from '@/lib/glossary';

export type QARuleId =
  | 'placeholder-parity'
  | 'html-tag-parity'
  | 'icu-variable-parity'
  | 'glossary-conflict'
  | 'repeated-source-consistency'
  | 'whitespace-drift'
  | 'punctuation-drift';

export type QASeverity = 'error' | 'warning';

export interface QAIssue {
  ruleId: QARuleId;
  severity: QASeverity;
  message: string;
  details?: string[];
}

export interface QAEntryReport {
  entryId: string;
  issues: QAIssue[];
  errorCount: number;
  warningCount: number;
  analyzedAt: string;
  glossaryAnalysis?: GlossaryAnalysisResult;
}

export interface QASummary {
  entriesWithIssues: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  byRule: Record<QARuleId, number>;
}
