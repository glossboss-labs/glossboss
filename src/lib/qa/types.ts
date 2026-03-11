import type { GlossaryAnalysisResult } from '@/lib/glossary';
import { msgid } from '@/lib/app-language';

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

export const QA_RULE_LABELS: Record<QARuleId, string> = {
  'placeholder-parity': msgid('Placeholder parity'),
  'html-tag-parity': msgid('HTML tag parity'),
  'icu-variable-parity': msgid('ICU variable parity'),
  'glossary-conflict': msgid('Glossary conflict'),
  'repeated-source-consistency': msgid('Repeated-source consistency'),
  'whitespace-drift': msgid('Whitespace drift'),
  'punctuation-drift': msgid('Punctuation drift'),
};
