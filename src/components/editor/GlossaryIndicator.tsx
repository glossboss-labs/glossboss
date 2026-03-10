/**
 * Glossary Indicator Component
 *
 * Shows a simple icon with x/x count for glossary term status.
 * Dark tooltip for readability.
 */

import { Badge, Tooltip, Stack, Text } from '@mantine/core';
import { BookOpen } from 'lucide-react';
import type { GlossaryAnalysisResult, TermAnalysisResult } from '@/lib/glossary/analyzer';

interface GlossaryIndicatorProps {
  /** Analysis result for this entry */
  analysis: GlossaryAnalysisResult | null;
}

/**
 * Format term details for tooltip
 */
function TermDetails({ terms }: { terms: TermAnalysisResult[] }) {
  const issues = terms.filter((t) => !t.found);
  const verified = terms.filter((t) => t.found);

  return (
    <Stack gap={6}>
      {issues.length > 0 && (
        <>
          <Text size="xs" fw={600} c="orange.3">
            Needs review:
          </Text>
          {issues.map((term, i) => (
            <Text key={i} size="xs">
              {term.term} →{' '}
              <Text span c="orange.3">
                {term.expectedTranslation}
              </Text>
            </Text>
          ))}
        </>
      )}
      {verified.length > 0 && (
        <>
          <Text size="xs" fw={600} c="green.4" mt={issues.length > 0 ? 4 : 0}>
            OK:
          </Text>
          {verified.map((term, i) => (
            <Text key={i} size="xs">
              {term.term} →{' '}
              <Text span c="green.4">
                {term.expectedTranslation}
              </Text>
            </Text>
          ))}
        </>
      )}
    </Stack>
  );
}

/**
 * Main Glossary Indicator - icon with x/x count
 */
export function GlossaryIndicator({ analysis }: GlossaryIndicatorProps) {
  if (!analysis || analysis.terms.length === 0) {
    return null;
  }

  const hasIssues = analysis.needsReviewCount > 0;
  const color = hasIssues ? 'orange' : 'green';

  return (
    <Tooltip
      label={<TermDetails terms={analysis.terms} />}
      multiline
      w={240}
      position="top"
      withArrow
      color="dark"
    >
      <Badge
        size="xs"
        color={color}
        variant="light"
        leftSection={<BookOpen size={10} />}
        style={{ cursor: 'help' }}
      >
        {analysis.matchedCount}/{analysis.terms.length}
      </Badge>
    </Tooltip>
  );
}

/**
 * Inline glossary term highlight for use within text
 */
export function GlossaryTermHighlight({
  term,
  children,
}: {
  term: TermAnalysisResult;
  children: React.ReactNode;
}) {
  const color = term.found ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-orange-6)';
  const bgColor = term.found
    ? 'var(--mantine-color-green-light)'
    : 'var(--mantine-color-orange-light)';

  return (
    <Tooltip
      label={
        <Text size="xs">
          {term.term} → {term.expectedTranslation}
        </Text>
      }
      position="top"
      withArrow
      color="dark"
    >
      <Text
        component="span"
        style={{
          borderBottom: `2px solid ${color}`,
          backgroundColor: bgColor,
          padding: '0 2px',
          borderRadius: 2,
          cursor: 'help',
        }}
      >
        {children}
      </Text>
    </Tooltip>
  );
}
