/**
 * Backup Section — settings export/import, translation memory export/import,
 * credential prompt handling, and ExportSection for cloud projects.
 */

import { useState, useCallback, useRef } from 'react';
import {
  Stack,
  Button,
  Group,
  Text,
  TextInput,
  Alert,
  Badge,
  Paper,
  Modal,
  FileButton,
} from '@mantine/core';
import { Check, AlertCircle, Download, Upload } from 'lucide-react';
import {
  applyAppSettingsFile,
  createAppSettingsFile,
  createAppSettingsFilename,
  parseAppSettingsFile,
  serializeAppSettingsFile,
  settingsFileHasCredentials,
  type AppSettingsFile,
} from '@/lib/app-settings';
import { useTranslation } from '@/lib/app-language';
import { useEditorStore, useTranslationMemoryStore } from '@/stores';
import {
  createTranslationMemoryScope,
  parseTranslationMemoryJson,
  parseTranslationMemoryTmx,
  serializeTranslationMemoryToJson,
  serializeTranslationMemoryToTmx,
} from '@/lib/translation-memory';
import { getDeepLSettings, isPersistEnabled } from '@/lib/deepl';
import { getAzureSettings, isAzurePersistEnabled } from '@/lib/azure';
import { getGeminiSettings, isGeminiPersistEnabled } from '@/lib/gemini';
import { getTranslationProviderSettings, type TranslationProviderId } from '@/lib/translation';
import { ExportSection } from '@/components/projects/ExportSection';
import type { ContainerWidth } from '@/lib/container-width';

export interface BackupSectionProps {
  /** Cloud project ID -- enables project export */
  projectId?: string | null;
  containerWidth?: ContainerWidth;
  branchChipEnabled?: boolean;
  speechEnabled?: boolean;
  translateEnabled?: boolean;
  onContainerWidthChange?: (width: ContainerWidth) => void;
  onBranchChipEnabledChange?: (enabled: boolean) => void;
  onSpeechEnabledChange?: (enabled: boolean) => void;
  onTranslateEnabledChange?: (enabled: boolean) => void;
  onGlossaryCleared?: () => void;
}

export function BackupSection({
  projectId,
  containerWidth = 'xl',
  branchChipEnabled = true,
  speechEnabled = true,
  translateEnabled = true,
  onContainerWidthChange,
  onBranchChipEnabledChange,
  onSpeechEnabledChange,
  onTranslateEnabledChange,
  onGlossaryCleared,
}: BackupSectionProps) {
  const { t } = useTranslation();
  const isDevelopment = import.meta.env.DEV;

  const projectName = useEditorStore((state) => state.projectName);
  const setProjectName = useEditorStore((state) => state.setProjectName);
  const targetLanguage = useEditorStore((state) => state.header?.language ?? null);
  const tmEntryCount = useTranslationMemoryStore((state) =>
    targetLanguage
      ? state.getEntryCount(createTranslationMemoryScope(projectName, targetLanguage))
      : 0,
  );
  const getTranslationMemoryProject = useTranslationMemoryStore((state) => state.getProject);
  const importTranslationMemoryEntries = useTranslationMemoryStore((state) => state.importEntries);
  const clearTranslationMemoryProject = useTranslationMemoryStore((state) => state.clearProject);

  const activeTranslationMemoryScope = targetLanguage
    ? createTranslationMemoryScope(projectName, targetLanguage)
    : null;

  const [transferResult, setTransferResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [credentialPrompt, setCredentialPrompt] = useState<
    { mode: 'export' } | { mode: 'import'; file: AppSettingsFile } | null
  >(null);

  const settingsImportResetRef = useRef<() => void>(null);
  const translationMemoryImportResetRef = useRef<(() => void) | null>(null);

  // --- Settings file export/import ---

  const downloadSettingsFile = useCallback(
    (includeApiKey: boolean) => {
      const deepl = getDeepLSettings();
      const azure = getAzureSettings();
      const gemini = getGeminiSettings();
      const provider: TranslationProviderId = getTranslationProviderSettings().provider;

      let glossaryLocale = '';
      let glossaryEnforcementEnabled = true;
      let navSkipTranslated = true;

      try {
        glossaryLocale = localStorage.getItem('glossboss-selected-glossary-locale') ?? '';
      } catch {
        /* ignore */
      }
      try {
        glossaryEnforcementEnabled =
          localStorage.getItem('glossboss-glossary-enforcement') !== 'false';
      } catch {
        /* ignore */
      }
      try {
        const raw = localStorage.getItem('glossboss-nav-skip-translated');
        navSkipTranslated = raw === null ? true : JSON.parse(raw) !== false;
      } catch {
        /* ignore */
      }

      const file = createAppSettingsFile(
        {
          translationProvider: provider,
          deepl: {
            apiKey: deepl.apiKey,
            apiType: deepl.apiType,
            formality: deepl.formality,
            persistKey: isPersistEnabled(),
          },
          azure: {
            apiKey: azure.apiKey,
            region: azure.region,
            endpoint: azure.endpoint,
            persistKey: isAzurePersistEnabled(),
          },
          gemini: {
            apiKey: gemini.apiKey,
            modelId: gemini.modelId,
            useProjectContext: gemini.useProjectContext,
            persistKey: isGeminiPersistEnabled(),
          },
          preferences: {
            glossaryLocale,
            glossaryEnforcementEnabled,
            navSkipTranslated,
            containerWidth,
            branchChipEnabled: isDevelopment ? branchChipEnabled : undefined,
            speechEnabled,
            translateEnabled,
          },
        },
        { includeApiKey },
      );

      const blob = new Blob([serializeAppSettingsFile(file)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = createAppSettingsFilename();
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setTransferResult({
        success: true,
        message: includeApiKey
          ? t('Settings exported with your saved translation credentials.')
          : t('Settings exported without your saved translation credentials.'),
      });
    },
    [branchChipEnabled, containerWidth, isDevelopment, speechEnabled, translateEnabled, t],
  );

  const applyImportedSettings = useCallback(
    (file: AppSettingsFile, includeApiKey: boolean) => {
      const applied = applyAppSettingsFile(file, { includeApiKey });

      onContainerWidthChange?.(applied.preferences.containerWidth);

      if (isDevelopment && typeof applied.preferences.branchChipEnabled === 'boolean') {
        onBranchChipEnabledChange?.(applied.preferences.branchChipEnabled);
      }

      if (typeof applied.preferences.speechEnabled === 'boolean') {
        onSpeechEnabledChange?.(applied.preferences.speechEnabled);
      }

      if (typeof applied.preferences.translateEnabled === 'boolean') {
        onTranslateEnabledChange?.(applied.preferences.translateEnabled);
      }

      // If glossary locale changed, clear existing glossary
      const nextGlossaryLocale = applied.preferences.glossaryLocale;
      try {
        const currentLocale = localStorage.getItem('glossboss-selected-glossary-locale') ?? '';
        if (nextGlossaryLocale !== currentLocale) {
          onGlossaryCleared?.();
        }
      } catch {
        /* ignore */
      }

      setTransferResult({
        success: true,
        message:
          includeApiKey && settingsFileHasCredentials(file)
            ? t('Settings imported, including your saved translation credentials.')
            : t('Settings imported without changing your current saved translation credentials.'),
      });
    },
    [
      isDevelopment,
      onBranchChipEnabledChange,
      onContainerWidthChange,
      onGlossaryCleared,
      onSpeechEnabledChange,
      onTranslateEnabledChange,
      t,
    ],
  );

  const handleExportClick = useCallback(() => {
    const deepl = getDeepLSettings();
    const azure = getAzureSettings();
    const gemini = getGeminiSettings();
    const hasCredentials = deepl.apiKey.trim() || azure.apiKey.trim() || gemini.apiKey.trim();

    if (hasCredentials) {
      setCredentialPrompt({ mode: 'export' });
      return;
    }

    downloadSettingsFile(false);
  }, [downloadSettingsFile]);

  const handleImportFile = useCallback(
    (file: File | null) => {
      if (!file) return;

      const reader = new FileReader();

      reader.onload = () => {
        try {
          const parsed = parseAppSettingsFile(String(reader.result ?? ''));

          if (settingsFileHasCredentials(parsed)) {
            setCredentialPrompt({
              mode: 'import',
              file: parsed,
            });
          } else {
            applyImportedSettings(parsed, false);
          }
        } catch (error) {
          setTransferResult({
            success: false,
            message:
              error instanceof Error
                ? error.message
                : t('Unable to import the selected settings file.'),
          });
        } finally {
          settingsImportResetRef.current?.();
        }
      };

      reader.onerror = () => {
        setTransferResult({
          success: false,
          message: t('Unable to read the selected settings file.'),
        });
        settingsImportResetRef.current?.();
      };

      reader.readAsText(file);
    },
    [applyImportedSettings, t],
  );

  // --- Translation memory ---

  const downloadTranslationMemoryFile = useCallback(
    (format: 'json' | 'tmx') => {
      if (!activeTranslationMemoryScope) {
        setTransferResult({
          success: false,
          message: t(
            'Load a translation file first so GlossBoss knows which target language to use.',
          ),
        });
        return;
      }

      const project = getTranslationMemoryProject(activeTranslationMemoryScope);
      if (!project || project.entries.length === 0) {
        setTransferResult({
          success: false,
          message: t('No translation memory entries are stored for this project yet.'),
        });
        return;
      }

      const content =
        format === 'json'
          ? serializeTranslationMemoryToJson(activeTranslationMemoryScope, project.entries)
          : serializeTranslationMemoryToTmx(activeTranslationMemoryScope, project.entries);
      const blob = new Blob([content], {
        type:
          format === 'json'
            ? 'application/json;charset=utf-8'
            : 'application/octet-stream;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${project.projectName.replace(/[^\w.-]+/g, '-').toLowerCase() || 'translation-memory'}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setTransferResult({
        success: true,
        message:
          format === 'json'
            ? t('Translation memory exported as JSON.')
            : t('Translation memory exported as TMX.'),
      });
    },
    [activeTranslationMemoryScope, getTranslationMemoryProject, t],
  );

  const handleTranslationMemoryImport = useCallback(
    (file: File | null) => {
      if (!file) return;

      void (async () => {
        try {
          const content = await file.text();
          const imported =
            file.name.toLowerCase().endsWith('.tmx') || file.name.toLowerCase().endsWith('.xml')
              ? parseTranslationMemoryTmx(content)
              : {
                  scope: activeTranslationMemoryScope,
                  entries: parseTranslationMemoryJson(content).entries,
                };

          const scope = activeTranslationMemoryScope ?? imported.scope;
          importTranslationMemoryEntries(scope, imported.entries);
          translationMemoryImportResetRef.current?.();
          setTransferResult({
            success: true,
            message: t('Imported {{count}} translation memory entries.', {
              count: imported.entries.length,
            }),
          });
        } catch (error) {
          setTransferResult({
            success: false,
            message:
              error instanceof Error ? error.message : t('Failed to import translation memory.'),
          });
        }
      })();
    },
    [activeTranslationMemoryScope, importTranslationMemoryEntries, t],
  );

  const handleClearTranslationMemory = useCallback(() => {
    if (!activeTranslationMemoryScope) {
      setTransferResult({
        success: false,
        message: t('Load a translation file before clearing project translation memory.'),
      });
      return;
    }

    clearTranslationMemoryProject(activeTranslationMemoryScope);
    setTransferResult({
      success: true,
      message: t('Cleared translation memory for this project.'),
    });
  }, [activeTranslationMemoryScope, clearTranslationMemoryProject, t]);

  return (
    <>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t(
            'Export your saved preferences to a JSON backup file, or restore them into this browser. Translation memory is managed separately below.',
          )}
        </Text>

        <Paper p="md" withBorder>
          <Stack gap="sm">
            <div>
              <Text size="sm" fw={500}>
                {t('Translation memory')}
              </Text>
              <Text size="xs" c="dimmed">
                {targetLanguage
                  ? t(
                      'Manage reusable approved translations for the current project. Import merges into the active project scope.',
                    )
                  : t(
                      'Load a translation file before managing translation memory so GlossBoss can scope entries to the active target language.',
                    )}
              </Text>
            </div>

            <TextInput
              label={t('Project name')}
              value={projectName}
              onChange={(event) => setProjectName(event.currentTarget.value)}
              disabled={!targetLanguage}
              placeholder={t('Project name')}
            />

            <Group gap="xs" wrap="wrap">
              <Badge variant="light" color="gray">
                {targetLanguage
                  ? t('{{count}} stored entries', { count: tmEntryCount })
                  : t('No active project')}
              </Badge>
              {targetLanguage && (
                <Badge variant="light" color="blue">
                  {t('Target: {{language}}', { language: targetLanguage })}
                </Badge>
              )}
            </Group>

            <Group>
              <Button
                leftSection={<Download size={14} />}
                variant="light"
                onClick={() => downloadTranslationMemoryFile('json')}
                disabled={!targetLanguage || tmEntryCount === 0}
              >
                {t('Export JSON')}
              </Button>
              <Button
                leftSection={<Download size={14} />}
                variant="light"
                onClick={() => downloadTranslationMemoryFile('tmx')}
                disabled={!targetLanguage || tmEntryCount === 0}
              >
                {t('Export TMX')}
              </Button>
              <FileButton
                resetRef={translationMemoryImportResetRef}
                onChange={handleTranslationMemoryImport}
                accept=".json,.tmx,.xml,application/json,text/xml,application/xml"
              >
                {(props) => (
                  <Button
                    variant="default"
                    leftSection={<Upload size={14} />}
                    {...props}
                    disabled={!targetLanguage}
                  >
                    {t('Import memory')}
                  </Button>
                )}
              </FileButton>
              <Button
                variant="subtle"
                color="red"
                onClick={handleClearTranslationMemory}
                disabled={!targetLanguage || tmEntryCount === 0}
              >
                {t('Clear memory')}
              </Button>
            </Group>
          </Stack>
        </Paper>

        <Paper p="md" withBorder>
          <Stack gap="sm">
            <div>
              <Text size="sm" fw={500}>
                {t('Settings file')}
              </Text>
              <Text size="xs" c="dimmed">
                {t(
                  'Exports translation provider preferences, provider-specific settings, glossary options, navigation behavior, display width, and development-only toggles. If saved translation credentials are present, you can choose whether to include them.',
                )}
              </Text>
            </div>

            <Group>
              <Button leftSection={<Download size={14} />} onClick={handleExportClick}>
                {t('Export settings')}
              </Button>

              <FileButton
                resetRef={settingsImportResetRef}
                onChange={handleImportFile}
                accept=".json,application/json"
              >
                {(props) => (
                  <Button variant="light" leftSection={<Upload size={14} />} {...props}>
                    {t('Import settings')}
                  </Button>
                )}
              </FileButton>
            </Group>
          </Stack>
        </Paper>

        <ExportSection projectId={projectId} />

        {transferResult && (
          <Alert
            color={transferResult.success ? 'green' : 'red'}
            icon={transferResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
          >
            <Text size="sm">{transferResult.message}</Text>
          </Alert>
        )}
      </Stack>

      {/* Credential prompt modal */}
      <Modal
        opened={credentialPrompt !== null}
        onClose={() => setCredentialPrompt(null)}
        title={
          credentialPrompt?.mode === 'import'
            ? t('Import saved credentials?')
            : t('Include saved credentials?')
        }
        centered
        size="sm"
        closeButtonProps={{ 'aria-label': t('Close credential prompt') }}
      >
        <Stack gap="md">
          <Alert color="yellow" icon={<AlertCircle size={16} />}>
            <Text size="sm">
              {credentialPrompt?.mode === 'import'
                ? t('This settings file contains saved translation credentials in plain text.')
                : t(
                    'Including saved translation credentials will store them in plain text inside the exported JSON file.',
                  )}
            </Text>
          </Alert>

          <Text size="sm">
            {credentialPrompt?.mode === 'import'
              ? t(
                  'Choose whether to import the saved translation credentials or keep the current credentials saved in this browser.',
                )
              : t(
                  'Choose whether to export saved translation credentials or keep the settings file free of credentials.',
                )}
          </Text>

          <Text size="xs" c="dimmed">
            {t('Only include credentials on personal, trusted devices.')}
          </Text>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCredentialPrompt(null)}>
              {t('Cancel')}
            </Button>
            <Button
              variant="default"
              onClick={() => {
                const currentPrompt = credentialPrompt;
                setCredentialPrompt(null);

                if (currentPrompt?.mode === 'import') {
                  applyImportedSettings(currentPrompt.file, false);
                  return;
                }

                downloadSettingsFile(false);
              }}
            >
              {credentialPrompt?.mode === 'import'
                ? t('Keep current key')
                : t('Export without credentials')}
            </Button>
            <Button
              onClick={() => {
                const currentPrompt = credentialPrompt;
                setCredentialPrompt(null);

                if (currentPrompt?.mode === 'import') {
                  applyImportedSettings(currentPrompt.file, true);
                  return;
                }

                downloadSettingsFile(true);
              }}
            >
              {credentialPrompt?.mode === 'import'
                ? t('Import credentials')
                : t('Include credentials')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
