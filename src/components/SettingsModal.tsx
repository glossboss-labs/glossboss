/**
 * Settings Modal Component
 *
 * Thin modal shell: tab navigation + section rendering.
 * All tab content is delegated to self-contained section components
 * under `src/components/settings/`.
 */

import { Modal, Tabs, Badge, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Key, BookOpen, Keyboard, Monitor, Download, GitBranch, Volume2 } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import type { Glossary } from '@/lib/glossary/types';
import type { ContainerWidth } from '@/lib/container-width';
import {
  TranslationSection,
  SpeechSection,
  GlossarySection,
  KeybindsSection,
  DisplaySection,
  BackupSection,
  DevelopmentSection,
} from '@/components/settings';

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  initialTab?: string;
  initialLocale?: string;
  /** Cloud project ID — enables project export in Backup tab */
  projectId?: string | null;
  onGlossaryLoaded?: (glossary: Glossary) => void;
  onGlossaryCleared?: () => void;
  onEnforcementChange?: (enabled: boolean) => void;
  onForceResync?: (glossary: Glossary) => void;
  glossary?: Glossary | null;
  syncStatus?: string | null;
  deeplGlossaryId?: string | null;
  glossaryTermCount?: number;
  selectedSourceText?: string | null;
  branchChipEnabled?: boolean;
  onBranchChipEnabledChange?: (enabled: boolean) => void;
  containerWidth?: ContainerWidth;
  onContainerWidthChange?: (width: ContainerWidth) => void;
  speechEnabled?: boolean;
  onSpeechEnabledChange?: (enabled: boolean) => void;
  translateEnabled?: boolean;
  onTranslateEnabledChange?: (enabled: boolean) => void;
}

export function SettingsModal({
  opened,
  onClose,
  initialTab,
  initialLocale,
  onGlossaryLoaded,
  onGlossaryCleared,
  onEnforcementChange,
  onForceResync,
  glossary,
  syncStatus,
  deeplGlossaryId,
  glossaryTermCount,
  selectedSourceText,
  branchChipEnabled = true,
  onBranchChipEnabledChange,
  containerWidth = 'xl',
  onContainerWidthChange,
  speechEnabled = true,
  onSpeechEnabledChange,
  translateEnabled = true,
  onTranslateEnabledChange,
  projectId,
}: SettingsModalProps) {
  const { t } = useTranslation();
  const themeSettings = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${themeSettings.breakpoints.sm})`);
  const isDevelopment = import.meta.env.DEV;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('Settings')}
      size={isMobile ? '100%' : 'xl'}
      fullScreen={isMobile}
      centered
      closeButtonProps={{ 'aria-label': t('Close settings') }}
    >
      <Tabs defaultValue={initialTab ?? 'api'}>
        <Tabs.List
          mb="md"
          style={{
            flexWrap: 'nowrap',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Tabs.Tab value="api" leftSection={<Key size={14} />}>
            {t('Translation')}
          </Tabs.Tab>
          <Tabs.Tab value="speech" leftSection={<Volume2 size={14} />}>
            {t('Speech')}
          </Tabs.Tab>
          <Tabs.Tab
            value="glossary"
            leftSection={<BookOpen size={14} />}
            rightSection={
              glossary ? (
                <Badge size="xs" color="green">
                  {glossary.entries.length}
                </Badge>
              ) : undefined
            }
          >
            {t('Glossary')}
          </Tabs.Tab>
          <Tabs.Tab value="keybinds" leftSection={<Keyboard size={14} />}>
            {t('Keyboard shortcuts')}
          </Tabs.Tab>
          <Tabs.Tab value="display" leftSection={<Monitor size={14} />}>
            {t('Display')}
          </Tabs.Tab>
          <Tabs.Tab value="transfer" leftSection={<Download size={14} />}>
            {t('Backup')}
          </Tabs.Tab>
          {isDevelopment && (
            <Tabs.Tab value="development" leftSection={<GitBranch size={14} />}>
              {t('Development')}
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="api">
          <TranslationSection
            translateEnabled={translateEnabled}
            onTranslateEnabledChange={onTranslateEnabledChange}
          />
        </Tabs.Panel>

        <Tabs.Panel value="speech">
          <SpeechSection
            speechEnabled={speechEnabled}
            onSpeechEnabledChange={onSpeechEnabledChange}
          />
        </Tabs.Panel>

        <Tabs.Panel value="glossary">
          <GlossarySection
            initialLocale={initialLocale}
            onGlossaryLoaded={onGlossaryLoaded}
            onGlossaryCleared={onGlossaryCleared}
            onEnforcementChange={onEnforcementChange}
            onForceResync={onForceResync}
            glossary={glossary}
            syncStatus={syncStatus}
            deeplGlossaryId={deeplGlossaryId}
            glossaryTermCount={glossaryTermCount}
            selectedSourceText={selectedSourceText}
          />
        </Tabs.Panel>

        <Tabs.Panel value="keybinds">
          <KeybindsSection />
        </Tabs.Panel>

        <Tabs.Panel value="display">
          <DisplaySection
            containerWidth={containerWidth}
            onContainerWidthChange={onContainerWidthChange}
          />
        </Tabs.Panel>

        <Tabs.Panel value="transfer">
          <BackupSection
            projectId={projectId}
            containerWidth={containerWidth}
            branchChipEnabled={branchChipEnabled}
            speechEnabled={speechEnabled}
            translateEnabled={translateEnabled}
            onContainerWidthChange={onContainerWidthChange}
            onBranchChipEnabledChange={onBranchChipEnabledChange}
            onSpeechEnabledChange={onSpeechEnabledChange}
            onTranslateEnabledChange={onTranslateEnabledChange}
            onGlossaryCleared={onGlossaryCleared}
          />
        </Tabs.Panel>

        {isDevelopment && (
          <Tabs.Panel value="development">
            <DevelopmentSection
              branchChipEnabled={branchChipEnabled}
              onBranchChipEnabledChange={onBranchChipEnabledChange}
            />
          </Tabs.Panel>
        )}
      </Tabs>
    </Modal>
  );
}
