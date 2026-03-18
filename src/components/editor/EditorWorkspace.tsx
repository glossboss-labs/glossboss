/**
 * EditorWorkspace — workspace controls and editor table.
 *
 * Clean Paper section with mode toggle, filter toolbar, and translate controls.
 * Follows the same visual pattern as Settings sections.
 */

import { Stack, Paper, Group, Text, Badge, Divider, SegmentedControl } from '@mantine/core';
import { Check } from 'lucide-react';
import {
  EditorTable,
  FilterToolbar,
  HeaderEditor,
  ReviewSummary,
  SourceFileIndicator,
  TranslateToolbar,
} from '@/components/editor';
import { useTranslation } from '@/lib/app-language';
import { getActiveTranslationProvider, getTranslationProviderLabel } from '@/lib/translation';
import type { TargetLanguage, SourceLanguage } from '@/lib/deepl/types';
import type { Glossary } from '@/lib/glossary/types';
import type { SupportedEncoding } from '@/lib/po';

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

  return (
    <>
      <Stack gap="md">
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
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Group justify="space-between" align="center" wrap="wrap">
              <Text size="sm" fw={600}>
                {workspaceMode === 'edit' ? t('Edit workspace') : t('Review workspace')}
              </Text>
              <SegmentedControl
                data-tour="workspace-mode"
                size="xs"
                value={workspaceMode}
                onChange={(value) => onWorkspaceModeChange(value as WorkspaceMode)}
                data={[
                  { label: t('Edit'), value: 'edit' },
                  { label: t('Review'), value: 'review' },
                ]}
              />
            </Group>

            <Divider />
            <FilterToolbar mode={workspaceMode} />

            {workspaceMode === 'review' && (
              <>
                <Divider />
                <ReviewSummary />
              </>
            )}

            <Divider />
            <TranslateToolbar
              onLanguageChange={onLanguageChange}
              deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null}
              glossary={glossary}
              translateEnabled={translateEnabled}
              mode={workspaceMode}
            />
            {workspaceMode === 'edit' && <SourceFileIndicator />}
            {workspaceMode === 'edit' && glossary && (
              <Group gap="xs">
                <Badge color="green" variant="light" size="sm" leftSection={<Check size={10} />}>
                  {t('Glossary: {count} terms ({locale})', {
                    count: glossary.entries.length,
                    locale: glossary.targetLocale,
                  })}
                </Badge>
                {glossarySyncStatus === 'ready' || deeplGlossaryId ? (
                  <Badge color="blue" variant="light" size="sm">
                    {t('{{provider}} ready', {
                      provider: getTranslationProviderLabel(getActiveTranslationProvider()),
                    })}
                  </Badge>
                ) : null}
              </Group>
            )}
          </Stack>
        </Paper>
      </Stack>

      <div data-tour="editor-table">
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
      </div>
    </>
  );
}
