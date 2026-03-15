/**
 * EditorWorkspace — workspace controls and editor table.
 *
 * Renders the header editor, mode switcher, filter/translate toolbars,
 * glossary badges, and the main EditorTable.
 */

import { Stack, Paper, Group, Text, Badge, Divider, SegmentedControl } from '@mantine/core';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import {
  EditorTable,
  FilterToolbar,
  HeaderEditor,
  ReviewSummary,
  TranslateToolbar,
} from '@/components/editor';
import { sectionVariants } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { getActiveTranslationProvider, getTranslationProviderLabel } from '@/lib/translation';
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

  /** Broadcast callback for realtime entry updates (cloud editor only). */
  broadcastEntryUpdate?: (event: {
    entryId: string;
    msgstr?: string;
    msgstrPlural?: string[];
    flags?: string[];
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
  broadcastEntryUpdate,
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
            <Divider />

            {workspaceMode === 'review' && <ReviewSummary />}
            <TranslateToolbar
              onLanguageChange={onLanguageChange}
              deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null}
              glossary={glossary}
              translateEnabled={translateEnabled}
              mode={workspaceMode}
            />
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

      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible" key="editor">
        <EditorTable
          targetLang={targetLang}
          sourceLang={sourceLang}
          glossary={glossary}
          deeplGlossaryId={glossaryEnforcementEnabled ? deeplGlossaryId : null}
          glossaryEnforcementEnabled={glossaryEnforcementEnabled}
          onEntrySelect={onEntrySelect}
          speechEnabled={speechEnabled}
          translateEnabled={translateEnabled}
          mode={workspaceMode}
          broadcastEntryUpdate={broadcastEntryUpdate}
        />
      </MotionDiv>
    </>
  );
}
