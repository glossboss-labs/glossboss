/**
 * Glossary Controls — glossary check button for bulk selection actions.
 */

import { useCallback } from 'react';
import { Button, Tooltip } from '@mantine/core';
import { motion, AnimatePresence } from 'motion/react';
import { BookCheck } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { analyzeTranslation } from '@/lib/glossary';
import { badgeVariants } from '@/lib/motion';
import type { Glossary, GlossaryAnalysisResult } from '@/lib/glossary/types';
import type { POEntry } from '@/lib/po';

const MotionDiv = motion.div;

export interface GlossaryControlsProps {
  glossary: Glossary | null;
  selectedEntries: POEntry[];
  selectedEntryIds: Set<string>;
  onGlossaryAnalysisBatch: (analyses: Map<string, GlossaryAnalysisResult>) => void;
  onBulkActionMessage: (message: string) => void;
}

export function GlossaryControls({
  glossary,
  selectedEntries,
  selectedEntryIds,
  onGlossaryAnalysisBatch,
  onBulkActionMessage,
}: GlossaryControlsProps) {
  const { t } = useTranslation();

  const handleGlossaryCheckSelected = useCallback(() => {
    if (!glossary || selectedEntries.length === 0) return;

    const analyses = new Map<string, GlossaryAnalysisResult>();
    selectedEntries.forEach((entry) => {
      analyses.set(
        entry.id,
        analyzeTranslation(entry.sourceText ?? entry.msgid, entry.msgstr, glossary, entry.id),
      );
    });

    onGlossaryAnalysisBatch(analyses);

    const withTerms = Array.from(analyses.values()).filter((analysis) => analysis.terms.length > 0);
    const needsReviewRows = withTerms.filter((analysis) => analysis.needsReviewCount > 0).length;

    if (withTerms.length === 0) {
      onBulkActionMessage(t('Glossary check complete: no glossary terms found in selected rows.'));
      return;
    }

    if (needsReviewRows === 0) {
      onBulkActionMessage(t('Glossary check complete: all selected rows match glossary terms.'));
      return;
    }

    onBulkActionMessage(
      t('Glossary check complete: {{count}} selected row(s) need review.', {
        count: needsReviewRows,
      }),
    );
  }, [glossary, selectedEntries, onGlossaryAnalysisBatch, onBulkActionMessage, t]);

  return (
    <AnimatePresence mode="popLayout">
      {selectedEntryIds.size > 0 && glossary && (
        <MotionDiv
          key="glossary-check-selected"
          layout
          variants={badgeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <Tooltip label={t('Re-run glossary analysis on selected rows')}>
            <Button
              size="xs"
              variant="light"
              color="violet"
              leftSection={<BookCheck size={14} />}
              onClick={handleGlossaryCheckSelected}
              aria-label={t('Glossary check selected')}
            >
              {t('Glossary check')}
            </Button>
          </Tooltip>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}
