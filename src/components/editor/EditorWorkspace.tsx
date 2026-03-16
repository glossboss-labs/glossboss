/**
 * EditorWorkspace — workspace controls and editor table.
 *
 * Clean layout: compact progress header, single-row toolbar, then the table.
 * No Paper wrapper around toolbars — lets the controls feel integrated.
 */

import { Stack, Group, Text, Badge, Box, Progress, SegmentedControl } from '@mantine/core';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import {
  EditorTable,
  FilterToolbar,
  HeaderEditor,
  ReviewSummary,
  TranslateToolbar,
} from '@/components/editor';
import { sectionVariants, interactiveSpring } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { getActiveTranslationProvider, getTranslationProviderLabel } from '@/lib/translation';
import { useEditorStore } from '@/stores/editor-store';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary } from '@/lib/glossary/types';
import type { SupportedEncoding } from '@/lib/po';

const MotionDiv = motion.div;

export type WorkspaceMode = 'edit' | 'review';

/** Encoding info for display */
export interface EncodingInfo {
  encoding: SupportedEncoding;
  confidence: string;
  method: string;
}

export interface EditorWorkspaceProps {
  workspaceMode: WorkspaceMode;
  onWorkspaceModeChange: (mode: WorkspaceMode) => void;

  encodingInfo: EncodingInfo | null;

  currentProjectType: string | null;
  currentProjectSlug: string | null;
  currentProjectRelease: string | null;
  onRefreshWordPress?: () => void;

  onLanguageChange: (source: SourceLanguage | undefined, target: TargetLanguage) => void;
  deeplGlossaryId: string | null;
  glossary: Glossary | null;
  glossaryEnforcementEnabled: boolean;
  translateEnabled: boolean;
  glossarySyncStatus: string | null;

  targetLang?: TargetLanguage;
  sourceLang?: SourceLanguage;
  speechEnabled: boolean;
  onEntrySelect: (sourceText: string) => void;

  /** When true, disables all editing (viewer role). */
  readOnly?: boolean;

  /** Broadcast callback for realtime entry updates (cloud editor only). */
  broadcastEntryUpdate?: (event: {
    entryId: string;
    msgstr?: string;
    msgstrPlural?: string[];
    flags?: string[];
  }) => void;
  /** Broadcast cell lock (cloud editor only). */
  broadcastLock?: (entryId: string) => void;
  /** Broadcast cell unlock (cloud editor only). */
  broadcastUnlock?: (entryId: string) => void;
  /** Broadcast review event (cloud editor only). */
  broadcastReviewEvent?: (event: {
    entryId: string;
    displayName: string;
    type: 'status-changed' | 'comment-added' | 'comment-resolved';
    data: {
      status?: import('@/lib/review').ReviewStatus;
      comment?: import('@/lib/review').ReviewComment;
      commentId?: string;
      resolved?: boolean;
    };
  }) => void;
}

export function EditorWorkspace({
  workspaceMode,
  onWorkspaceModeChange,
  encodingInfo,
  currentProjectType,
  currentProjectSlug,
  currentProjectRelease,
  onRefreshWordPress,
  onLanguageChange,
  deeplGlossaryId,
  glossary,
  glossaryEnforcementEnabled,
  translateEnabled,
  glossarySyncStatus,
  targetLang,
  sourceLang,
  speechEnabled,
  onEntrySelect,
  readOnly,
  broadcastEntryUpdate,
  broadcastLock,
  broadcastUnlock,
  broadcastReviewEvent,
}: EditorWorkspaceProps) {
  const { t } = useTranslation();
  const { getStats } = useEditorStore();
  const stats = getStats();
  const percentage = stats.total > 0 ? Math.round((stats.translated / stats.total) * 100) : 0;

  // Glossary tooltip content
  const glossaryLabel = glossary
    ? `${glossary.entries.length} ${t('terms')} (${glossary.targetLocale})`
    : null;
  const providerReady =
    glossarySyncStatus === 'ready' || deeplGlossaryId
      ? getTranslationProviderLabel(getActiveTranslationProvider())
      : null;

  return (
    <>
      <Stack gap="sm">
        <HeaderEditor
          encodingInfo={encodingInfo}
          wordPressProject={
            currentProjectType && currentProjectSlug
              ? {
                  type: currentProjectType,
                  slug: currentProjectSlug,
                  release: currentProjectRelease,
                }
              : null
          }
          onRefreshWordPress={
            currentProjectType && currentProjectSlug ? onRefreshWordPress : undefined
          }
        />

        {/* Compact header: progress + glossary status + mode toggle */}
        <Group justify="space-between" align="center" wrap="wrap" gap="xs">
          <Group gap="sm" wrap="nowrap">
            {/* Progress */}
            <Group gap={6} wrap="nowrap">
              <Box style={{ width: 80 }}>
                <Progress
                  value={percentage}
                  size="sm"
                  radius="xl"
                  color={percentage === 100 ? 'green' : percentage > 50 ? 'blue' : 'orange'}
                />
              </Box>
              <motion.span
                key={percentage}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                transition={interactiveSpring}
              >
                <Text
                  size="sm"
                  fw={600}
                  component="span"
                  c={percentage === 100 ? 'green' : undefined}
                  className="gb-tabular-nums"
                >
                  {t('{{percentage}}% translated', { percentage })}
                </Text>
              </motion.span>
            </Group>

            {/* Glossary status (compact) */}
            {workspaceMode === 'edit' && glossaryLabel && (
              <Badge color="green" variant="light" size="sm" leftSection={<Check size={10} />}>
                {glossaryLabel}
                {providerReady && ` · ${providerReady}`}
              </Badge>
            )}
          </Group>

          <SegmentedControl
            size="xs"
            value={workspaceMode}
            onChange={(value) => onWorkspaceModeChange(value as WorkspaceMode)}
            data={[
              { label: t('Edit'), value: 'edit' },
              { label: t('Review'), value: 'review' },
            ]}
          />
        </Group>

        {/* Single-row toolbar */}
        <FilterToolbar mode={workspaceMode} />

        {/* Review summary (only in review mode) */}
        {workspaceMode === 'review' && <ReviewSummary />}

        {/* Translation controls */}
        <TranslateToolbar
          onLanguageChange={onLanguageChange}
          deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null}
          glossary={glossary}
          translateEnabled={translateEnabled}
          mode={workspaceMode}
        />
      </Stack>

      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible" key="editor">
        <EditorTable
          targetLang={targetLang}
          sourceLang={sourceLang}
          glossary={glossary}
          deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null}
          glossaryEnforcementEnabled={glossaryEnforcementEnabled}
          onEntrySelect={onEntrySelect}
          speechEnabled={speechEnabled}
          translateEnabled={readOnly ? false : translateEnabled}
          mode={workspaceMode}
          readOnly={readOnly}
          broadcastEntryUpdate={broadcastEntryUpdate}
          broadcastLock={broadcastLock}
          broadcastUnlock={broadcastUnlock}
          broadcastReviewEvent={broadcastReviewEvent}
        />
      </MotionDiv>
    </>
  );
}
