import { Alert, Badge, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { AlertTriangle } from 'lucide-react';
import { FeedbackModal } from '@/components/feedback';
import { SettingsModal } from '@/components/SettingsModal';
import { RepoSyncModal } from '@/components/repo-sync';
import {
  type WordPressProjectOpenRequest,
  WordPressProjectModal,
  WordPressRefreshModal,
} from '@/components/editor';
import { ConfirmModal, PromptModal } from '@/components/ui';
import { type FeedbackIssueSuccess } from '@/lib/feedback';
import type { Glossary } from '@/lib/glossary/types';
import type { POEntry } from '@/lib/po';
import { QA_RULE_LABELS, type QASummary } from '@/lib/qa';
import type { ContainerWidth } from '@/lib/container-width';
import type { WordPressPluginTranslationTrack } from '@/lib/wp-source';
import { msgid, useTranslation } from '@/lib/app-language';
import type { FileFormat } from '@/stores';

type RepoSyncInitialTab = 'connect' | 'browse' | 'push' | undefined;

export interface IndexPageDialogsProps {
  confirmClearOpen: boolean;
  onCloseConfirmClear: () => void;
  onConfirmClear: () => void;

  pendingUrl: string | null;
  onClosePendingUrl: () => void;
  onConfirmPendingUrl: () => void;

  pendingProject: WordPressProjectOpenRequest | null;
  onClosePendingProject: () => void;
  onConfirmPendingProject: () => void;

  urlPromptOpen: boolean;
  onCloseUrlPrompt: () => void;
  onSubmitUrlPrompt: (url: string) => void;

  wordpressProjectOpen: boolean;
  onCloseWordPressProject: () => void;
  initialLocale: string;
  onOpenWordPressProject: (request: WordPressProjectOpenRequest) => Promise<void>;

  canRefreshWordPress: boolean;
  wordpressRefreshOpen: boolean;
  onCloseWordPressRefresh: () => void;
  currentProjectType: string | null;
  currentProjectSlug: string | null;
  currentEntries: POEntry[];
  currentProjectRelease: string | null;
  onApplyWordPressRefresh: (payload: {
    mergedEntries: POEntry[];
    deltaEntryIds: string[];
    release: string | null;
    track: WordPressPluginTranslationTrack;
    summary: { added: number; removed: number; changed: number; metaUpdated: number };
    refreshGlossary: boolean;
  }) => Promise<void>;

  settingsOpen: boolean;
  onCloseSettings: () => void;
  settingsInitialTab: string | undefined;
  glossary: Glossary | null;
  glossarySyncStatus: string | null;
  deeplGlossaryId: string | null;
  glossaryTermCount: number;
  selectedSourceText: string | null;
  branchChipEnabled: boolean;
  onBranchChipEnabledChange: (enabled: boolean) => void;
  containerWidth: ContainerWidth;
  onContainerWidthChange: (width: ContainerWidth) => void;
  speechEnabled: boolean;
  onSpeechEnabledChange: (enabled: boolean) => void;
  translateEnabled: boolean;
  onTranslateEnabledChange: (enabled: boolean) => void;
  onGlossaryLoaded: (glossary: Glossary) => Promise<void>;
  onGlossaryCleared: () => void;
  onEnforcementChange: (enabled: boolean) => void;
  onForceResync: (glossary: Glossary) => Promise<void>;

  repoSyncOpen: boolean;
  onCloseRepoSync: () => void;
  onRepoFileLoaded: (content: string, filename: string) => void;
  serializedContentForPush: string | null;
  repoSyncInitialTab: RepoSyncInitialTab;

  qaSummaryOpen: boolean;
  onCloseQaSummary: () => void;
  qaSummary: QASummary;
  pendingExportFormat: FileFormat | null;
  onConfirmExportAnyway: () => void;

  feedbackOpen: boolean;
  onCloseFeedback: () => void;
  currentFilename: string | null;
  onFeedbackSubmitted: (result: FeedbackIssueSuccess) => void;
  onFeedbackSubmitError: (message: string) => void;
}

export function IndexPageDialogs({
  confirmClearOpen,
  onCloseConfirmClear,
  onConfirmClear,
  pendingUrl,
  onClosePendingUrl,
  onConfirmPendingUrl,
  pendingProject,
  onClosePendingProject,
  onConfirmPendingProject,
  urlPromptOpen,
  onCloseUrlPrompt,
  onSubmitUrlPrompt,
  wordpressProjectOpen,
  onCloseWordPressProject,
  initialLocale,
  onOpenWordPressProject,
  canRefreshWordPress,
  wordpressRefreshOpen,
  onCloseWordPressRefresh,
  currentProjectType,
  currentProjectSlug,
  currentEntries,
  currentProjectRelease,
  onApplyWordPressRefresh,
  settingsOpen,
  onCloseSettings,
  settingsInitialTab,
  glossary,
  glossarySyncStatus,
  deeplGlossaryId,
  glossaryTermCount,
  selectedSourceText,
  branchChipEnabled,
  onBranchChipEnabledChange,
  containerWidth,
  onContainerWidthChange,
  speechEnabled,
  onSpeechEnabledChange,
  translateEnabled,
  onTranslateEnabledChange,
  onGlossaryLoaded,
  onGlossaryCleared,
  onEnforcementChange,
  onForceResync,
  repoSyncOpen,
  onCloseRepoSync,
  onRepoFileLoaded,
  serializedContentForPush,
  repoSyncInitialTab,
  qaSummaryOpen,
  onCloseQaSummary,
  qaSummary,
  pendingExportFormat,
  onConfirmExportAnyway,
  feedbackOpen,
  onCloseFeedback,
  currentFilename,
  onFeedbackSubmitted,
  onFeedbackSubmitError,
}: IndexPageDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <ConfirmModal
        opened={confirmClearOpen}
        onClose={onCloseConfirmClear}
        onConfirm={onConfirmClear}
        title={t('Clear editor?')}
        message={t('You have unsaved changes. Are you sure you want to clear the editor?')}
        detail={t('This will remove all your work on the current file.')}
        confirmLabel={msgid('Clear anyway')}
        confirmColor="red"
        variant="danger"
      />

      <ConfirmModal
        opened={pendingUrl !== null}
        onClose={onClosePendingUrl}
        onConfirm={onConfirmPendingUrl}
        title={t('Replace current file?')}
        message={t(
          'Loading a new file from URL will replace the currently loaded file. Any unsaved changes will be lost.',
        )}
        confirmLabel={msgid('Replace')}
        variant="warning"
      />

      <ConfirmModal
        opened={pendingProject !== null}
        onClose={onClosePendingProject}
        onConfirm={onConfirmPendingProject}
        title={t('Replace current file?')}
        message={t(
          'Opening a WordPress project will replace the currently loaded file. Any unsaved changes will be lost.',
        )}
        confirmLabel={msgid('Replace')}
        variant="warning"
      />

      <PromptModal
        opened={urlPromptOpen}
        onClose={onCloseUrlPrompt}
        onSubmit={onSubmitUrlPrompt}
        title={t('Load from URL')}
        label={t('File URL')}
        placeholder="https://example.com/locale/en.po"
        submitLabel={msgid('Load')}
      />

      <WordPressProjectModal
        opened={wordpressProjectOpen}
        onClose={onCloseWordPressProject}
        initialLocale={initialLocale}
        onOpenProject={onOpenWordPressProject}
      />

      {canRefreshWordPress && currentProjectType && currentProjectSlug && (
        <WordPressRefreshModal
          opened={wordpressRefreshOpen}
          onClose={onCloseWordPressRefresh}
          projectType={currentProjectType}
          projectSlug={currentProjectSlug}
          currentEntries={currentEntries}
          currentRelease={currentProjectRelease}
          locale={initialLocale}
          onApplyRefresh={onApplyWordPressRefresh}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          opened={settingsOpen}
          onClose={onCloseSettings}
          initialTab={settingsInitialTab}
          initialLocale={initialLocale}
          onGlossaryLoaded={onGlossaryLoaded}
          onGlossaryCleared={onGlossaryCleared}
          onEnforcementChange={onEnforcementChange}
          onForceResync={onForceResync}
          glossary={glossary}
          syncStatus={glossarySyncStatus}
          deeplGlossaryId={deeplGlossaryId}
          glossaryTermCount={glossaryTermCount}
          selectedSourceText={selectedSourceText}
          branchChipEnabled={branchChipEnabled}
          onBranchChipEnabledChange={onBranchChipEnabledChange}
          containerWidth={containerWidth}
          onContainerWidthChange={onContainerWidthChange}
          speechEnabled={speechEnabled}
          onSpeechEnabledChange={onSpeechEnabledChange}
          translateEnabled={translateEnabled}
          onTranslateEnabledChange={onTranslateEnabledChange}
        />
      )}

      {repoSyncOpen && (
        <RepoSyncModal
          opened={repoSyncOpen}
          onClose={onCloseRepoSync}
          onFileLoaded={onRepoFileLoaded}
          serializedContent={serializedContentForPush}
          initialTab={repoSyncInitialTab}
        />
      )}

      <Modal
        opened={qaSummaryOpen}
        onClose={onCloseQaSummary}
        title={t('QA summary before export')}
        centered
        size="lg"
        closeButtonProps={{ 'aria-label': t('Close QA summary') }}
      >
        <Stack gap="md">
          <Alert color="yellow" icon={<AlertTriangle size={16} />}>
            <Text size="sm">
              {t(
                'GlossBoss found QA issues in the current file. You can review them now or export anyway.',
              )}
            </Text>
          </Alert>

          <Group gap="xs" wrap="wrap">
            <Badge color="red" variant="light">
              {t('{{count}} error issue(s)', { count: qaSummary.errors })}
            </Badge>
            <Badge color="orange" variant="light">
              {t('{{count}} warning issue(s)', { count: qaSummary.warnings })}
            </Badge>
            <Badge color="gray" variant="light">
              {t('{{count}} total issues', { count: qaSummary.totalIssues })}
            </Badge>
          </Group>

          <Stack gap="xs">
            {Object.entries(qaSummary.byRule)
              .filter(([, count]) => count > 0)
              .map(([ruleId, count]) => (
                <Group key={ruleId} justify="space-between">
                  <Text size="sm">{t(QA_RULE_LABELS[ruleId as keyof typeof QA_RULE_LABELS])}</Text>
                  <Badge variant="light" color="gray">
                    {count}
                  </Badge>
                </Group>
              ))}
          </Stack>

          <Group justify="flex-end">
            <Button variant="default" onClick={onCloseQaSummary}>
              {t('Review issues')}
            </Button>
            <Button onClick={onConfirmExportAnyway} disabled={!pendingExportFormat}>
              {t('Export anyway')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {feedbackOpen && (
        <FeedbackModal
          opened={feedbackOpen}
          onClose={onCloseFeedback}
          currentFilename={currentFilename}
          onSubmitted={onFeedbackSubmitted}
          onSubmitError={onFeedbackSubmitError}
        />
      )}
    </>
  );
}
