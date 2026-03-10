/**
 * Settings Modal Component
 *
 * Unified settings panel for:
 * - DeepL API key configuration
 * - Glossary management (load, view, configure)
 * - Display preferences (container width)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  Stack,
  Tabs,
  PasswordInput,
  Button,
  Group,
  Text,
  Alert,
  Badge,
  SegmentedControl,
  Progress,
  Divider,
  Select,
  Switch,
  Loader,
  Paper,
  ActionIcon,
  Tooltip,
  Anchor,
  Table,
  Kbd,
  FileButton,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import {
  Key,
  BookOpen,
  Check,
  AlertCircle,
  RefreshCw,
  X,
  ExternalLink,
  Eye,
  Keyboard,
  GitBranch,
  Monitor,
  Languages,
  Upload,
  Volume2,
  Download,
} from 'lucide-react';
import {
  getDeepLSettings,
  saveDeepLSettings,
  clearDeepLSettings,
  isPersistEnabled,
  setPersistEnabled,
  type DeepLApiType,
  type DeepLFormality,
  getDeepLClient,
} from '@/lib/deepl';
import {
  clearTtsSettings,
  getBrowserVoices,
  getElevenLabsClient,
  getTtsSettings,
  isTtsPersistEnabled,
  primeElevenLabsVoices,
  saveTtsSettings,
  saveTtsUsage,
  setTtsPersistEnabled,
  type TtsProviderId,
  type TtsUsageStats,
  type TtsVoiceSummary,
} from '@/lib/tts';
import { fetchWPGlossary, clearWPGlossaryCache, type FetchResult } from '@/lib/glossary/wp-fetcher';
import { parseGlossaryCSV, isValidGlossaryCSV } from '@/lib/glossary/csv-parser';
import { GlossaryTermsPreview, GlossaryViewerModal } from '@/components/glossary/shared';
import {
  COMMON_GLOSSARY_LOCALES,
  GLOSSARY_ENFORCEMENT_KEY,
  GLOSSARY_SELECTED_LOCALE_KEY,
} from '@/components/glossary/constants';
import type { Glossary } from '@/lib/glossary/types';
import { NAV_SKIP_TRANSLATED_KEY } from '@/components/editor/EditorTable';
import { CONTAINER_WIDTH_OPTIONS, type ContainerWidth } from '@/lib/container-width';
import {
  applyAppSettingsFile,
  createAppSettingsFile,
  createAppSettingsFilename,
  parseAppSettingsFile,
  serializeAppSettingsFile,
  settingsFileHasCredentials,
  type AppSettingsFile,
} from '@/lib/app-settings';
import { APP_LANGUAGE_OPTIONS, msgid, useTranslation, type AppLanguage } from '@/lib/app-language';

/** Keyboard shortcut definitions */
const KEYBINDS: { keys: string[][]; action: string; description?: string }[] = [
  {
    keys: [['Tab']],
    action: msgid('Next field'),
    description: msgid('Save current field and move to the next translation field'),
  },
  {
    keys: [['Shift', 'Tab']],
    action: msgid('Previous field'),
    description: msgid('Save current field and move to the previous translation field'),
  },
  {
    keys: [['Enter']],
    action: msgid('Next field'),
    description: msgid('Save current field and move to the next translation field'),
  },
  {
    keys: [['Shift', 'Enter']],
    action: msgid('New line'),
    description: msgid('Insert a line break in the translation'),
  },
  {
    keys: [
      ['⌘', 'Enter'],
      ['Ctrl', 'Enter'],
    ],
    action: msgid('Next entry'),
    description: msgid('Save and jump to the next translation entry (skips translated by default)'),
  },
  {
    keys: [['Escape']],
    action: msgid('Cancel edit'),
    description: msgid('Discard changes and exit the current field'),
  },
];

/** Renders a key combination using Mantine Kbd components */
function KeyCombo({ keys }: { keys: string[][] }) {
  return (
    <Group gap={6}>
      {keys.map((combo, ci) => (
        <Group key={ci} gap={4} wrap="nowrap">
          {ci > 0 && (
            <Text size="xs" c="dimmed">
              /
            </Text>
          )}
          {combo.map((key, ki) => (
            <span key={ki} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {ki > 0 && (
                <Text size="xs" c="dimmed">
                  +
                </Text>
              )}
              <Kbd size="sm">{key}</Kbd>
            </span>
          ))}
        </Group>
      ))}
    </Group>
  );
}

/** Keyboard shortcuts settings panel */
function KeyboardShortcutsPanel({
  skipTranslated,
  onSkipTranslatedChange,
}: {
  skipTranslated: boolean;
  onSkipTranslatedChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t('Keyboard shortcuts available when editing translations.')}
      </Text>

      <Paper withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: '35%' }}>{t('Shortcut')}</Table.Th>
              <Table.Th style={{ width: '20%' }}>{t('Action')}</Table.Th>
              <Table.Th>{t('Description')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {KEYBINDS.map((bind, i) => (
              <Table.Tr key={i}>
                <Table.Td>
                  <KeyCombo keys={bind.keys} />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {t(bind.action)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {bind.description ? t(bind.description) : null}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Divider />

      <Text size="sm" fw={500}>
        {t('Navigation Settings')}
      </Text>

      <Switch
        label={t('Skip translated entries')}
        description={t(
          'When using ⌘/Ctrl+Enter, skip entries that are already translated and jump to the next untranslated or fuzzy entry',
        )}
        checked={skipTranslated}
        onChange={(e) => onSkipTranslatedChange(e.currentTarget.checked)}
        styles={{
          track: {
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
          },
          thumb: {
            transition: 'transform 0.2s ease, left 0.2s ease',
          },
        }}
      />
    </Stack>
  );
}

interface SettingsModalProps {
  opened: boolean;
  onClose: () => void;
  initialLocale?: string;
  onGlossaryLoaded?: (glossary: Glossary) => void;
  onGlossaryCleared?: () => void;
  onEnforcementChange?: (enabled: boolean) => void;
  onForceResync?: (glossary: Glossary) => void;
  glossary?: Glossary | null;
  syncStatus?: string | null;
  deeplGlossaryId?: string | null;
  deeplTermCount?: number;
  selectedSourceText?: string | null;
  branchChipEnabled?: boolean;
  onBranchChipEnabledChange?: (enabled: boolean) => void;
  containerWidth?: ContainerWidth;
  onContainerWidthChange?: (width: ContainerWidth) => void;
}

export function SettingsModal({
  opened,
  onClose,
  initialLocale,
  onGlossaryLoaded,
  onGlossaryCleared,
  onEnforcementChange,
  onForceResync,
  glossary,
  syncStatus,
  deeplGlossaryId,
  deeplTermCount,
  selectedSourceText,
  branchChipEnabled = true,
  onBranchChipEnabledChange,
  containerWidth = 'xl',
  onContainerWidthChange,
}: SettingsModalProps) {
  const { language, setLanguage, t } = useTranslation();
  const isDevelopment = import.meta.env.DEV;

  // DeepL API settings state
  const [apiKey, setApiKey] = useState('');
  const [apiType, setApiType] = useState<DeepLApiType>('free');
  const [formality, setFormality] = useState<DeepLFormality>('prefer_less');
  const [persistKey, setPersistKey] = useState(() => isPersistEnabled());
  const [skipTranslated, setSkipTranslated] = useLocalStorage<boolean>({
    key: NAV_SKIP_TRANSLATED_KEY,
    defaultValue: true,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    usage?: { used: number; limit: number };
  } | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [ttsProvider, setTtsProvider] = useState<TtsProviderId>('browser');
  const [ttsApiKey, setTtsApiKey] = useState('');
  const [ttsPersistKey, setTtsPersistKey] = useState(() => isTtsPersistEnabled());
  const [ttsRate, setTtsRate] = useState('1');
  const [ttsTesting, setTtsTesting] = useState(false);
  const [ttsVoicesLoading, setTtsVoicesLoading] = useState(false);
  const [ttsSaved, setTtsSaved] = useState(false);
  const [ttsResult, setTtsResult] = useState<{
    success: boolean;
    message: string;
    usage?: { used: number; limit: number; resetAt?: number | null; tier?: string | null };
  } | null>(null);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<TtsVoiceSummary[]>([]);
  const [sourceBrowserVoiceURI, setSourceBrowserVoiceURI] = useState<string | null>(null);
  const [translationBrowserVoiceURI, setTranslationBrowserVoiceURI] = useState<string | null>(null);
  const [sourceElevenLabsVoiceId, setSourceElevenLabsVoiceId] = useState<string | null>(null);
  const [translationElevenLabsVoiceId, setTranslationElevenLabsVoiceId] = useState<string | null>(
    null,
  );
  const [transferResult, setTransferResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [credentialPrompt, setCredentialPrompt] = useState<
    | {
        mode: 'export';
      }
    | {
        mode: 'import';
        file: AppSettingsFile;
      }
    | null
  >(null);

  // Glossary state
  const [selectedLocale, setSelectedLocale] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(GLOSSARY_SELECTED_LOCALE_KEY);
      return stored || initialLocale || '';
    } catch {
      return initialLocale || '';
    }
  });
  const [isLoadingGlossary, setIsLoadingGlossary] = useState(false);
  const [glossaryError, setGlossaryError] = useState<string | null>(null);
  const [enforcementEnabled, setEnforcementEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(GLOSSARY_ENFORCEMENT_KEY);
      return stored !== 'false';
    } catch {
      return true;
    }
  });
  const [viewerOpened, setViewerOpened] = useState(false);
  const [hasAttemptedAutoLoad, setHasAttemptedAutoLoad] = useState(false);
  const settingsImportResetRef = useRef<() => void>(null);
  const loadTokenRef = useRef(0);

  // Load saved settings on open
  useEffect(() => {
    if (opened) {
      const settings = getDeepLSettings();
      setApiKey(settings.apiKey);
      setApiType(settings.apiType);
      setFormality(settings.formality);
      setIsSaved(Boolean(settings.apiKey));
      setPersistKey(isPersistEnabled());

      const ttsSettings = getTtsSettings();
      setTtsProvider(ttsSettings.provider);
      setTtsApiKey(ttsSettings.apiKey);
      setTtsPersistKey(isTtsPersistEnabled());
      setTtsRate(String(ttsSettings.rate));
      setSourceBrowserVoiceURI(ttsSettings.sourceBrowserVoiceURI);
      setTranslationBrowserVoiceURI(ttsSettings.translationBrowserVoiceURI);
      setSourceElevenLabsVoiceId(ttsSettings.sourceElevenLabsVoiceId);
      setTranslationElevenLabsVoiceId(ttsSettings.translationElevenLabsVoiceId);
      setTtsSaved(Boolean(ttsSettings.apiKey) || ttsSettings.provider === 'browser');
      setTtsResult(
        ttsSettings.elevenLabsUsage
          ? {
              success: true,
              message: t('Usage loaded from the last successful check.'),
              usage: {
                used: ttsSettings.elevenLabsUsage.characterCount,
                limit: ttsSettings.elevenLabsUsage.characterLimit,
                resetAt: ttsSettings.elevenLabsUsage.nextResetUnix ?? null,
                tier: ttsSettings.elevenLabsUsage.tier ?? null,
              },
            }
          : null,
      );
      return;
    }

    setCredentialPrompt(null);
  }, [opened, t]);

  useEffect(() => {
    const loadVoices = () => {
      setBrowserVoices(getBrowserVoices());
    };

    loadVoices();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, []);

  // Update locale when initialLocale changes
  useEffect(() => {
    if (initialLocale && initialLocale !== selectedLocale && !glossary) {
      setSelectedLocale(initialLocale);
    }
  }, [initialLocale]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist locale selection
  useEffect(() => {
    try {
      if (selectedLocale) {
        localStorage.setItem(GLOSSARY_SELECTED_LOCALE_KEY, selectedLocale);
      } else {
        localStorage.removeItem(GLOSSARY_SELECTED_LOCALE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [selectedLocale]);

  // Persist enforcement setting
  useEffect(() => {
    try {
      localStorage.setItem(GLOSSARY_ENFORCEMENT_KEY, String(enforcementEnabled));
    } catch {
      // Ignore storage errors
    }
    onEnforcementChange?.(enforcementEnabled);
  }, [enforcementEnabled, onEnforcementChange]);

  const handleTestKey = useCallback(async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: t('Please enter an API key') });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      saveDeepLSettings({ apiKey, apiType, formality });
      const client = getDeepLClient();
      const usage = await client.getUsage();

      setTestResult({
        success: true,
        message: t('API key is valid!'),
        usage: { used: usage.characterCount, limit: usage.characterLimit },
      });
      setIsSaved(true);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : t('Failed to connect'),
      });
      clearDeepLSettings();
      setIsSaved(false);
    } finally {
      setIsTesting(false);
    }
  }, [apiKey, apiType, formality, t]);

  const handleSaveApiKey = useCallback(() => {
    saveDeepLSettings({ apiKey, apiType, formality });
    setIsSaved(true);
    setTestResult({ success: true, message: t('Settings saved!') });
  }, [apiKey, apiType, formality, t]);

  const handleClearApiKey = useCallback(() => {
    clearDeepLSettings();
    setApiKey('');
    setApiType('free');
    setFormality('prefer_less');
    setPersistKey(false);
    setIsSaved(false);
    setTestResult(null);
  }, []);

  const loadElevenLabsVoices = useCallback(async () => {
    setTtsVoicesLoading(true);

    try {
      const voices = await getElevenLabsClient().listVoices();
      setElevenLabsVoices(voices);
      if (voices.length > 0) {
        setSourceElevenLabsVoiceId((current) => current ?? voices[0].voiceId);
        setTranslationElevenLabsVoiceId((current) => current ?? voices[0].voiceId);
      }
      primeElevenLabsVoices(voices);
    } catch (error) {
      console.warn('[TTS] Failed to load ElevenLabs voices:', error);
    } finally {
      setTtsVoicesLoading(false);
    }
  }, []);

  const handleTestTtsKey = useCallback(async () => {
    if (!ttsApiKey.trim()) {
      setTtsResult({ success: false, message: t('Please enter an API key') });
      return;
    }

    setTtsTesting(true);
    setTtsResult(null);

    try {
      saveTtsSettings({
        provider: 'elevenlabs',
        apiKey: ttsApiKey,
        rate: Number(ttsRate),
        sourceBrowserVoiceURI,
        translationBrowserVoiceURI,
        sourceElevenLabsVoiceId,
        translationElevenLabsVoiceId,
      });
      const usage = await getElevenLabsClient().testKey();
      await loadElevenLabsVoices();

      setTtsResult({
        success: true,
        message: t('API key is valid!'),
        usage: {
          used: usage.characterCount,
          limit: usage.characterLimit,
          resetAt: usage.nextResetUnix ?? null,
          tier: usage.tier ?? null,
        },
      });
      setTtsSaved(true);
    } catch (error) {
      setTtsResult({
        success: false,
        message: error instanceof Error ? error.message : t('Failed to connect'),
      });
      saveTtsUsage(null);
      setTtsSaved(false);
    } finally {
      setTtsTesting(false);
    }
  }, [
    loadElevenLabsVoices,
    sourceBrowserVoiceURI,
    sourceElevenLabsVoiceId,
    translationBrowserVoiceURI,
    translationElevenLabsVoiceId,
    ttsApiKey,
    ttsRate,
    t,
  ]);

  const handleSaveTtsSettings = useCallback(() => {
    const usage =
      ttsResult?.usage && ttsProvider === 'elevenlabs'
        ? ({
            characterCount: ttsResult.usage.used,
            characterLimit: ttsResult.usage.limit,
            nextResetUnix: ttsResult.usage.resetAt ?? null,
            tier: ttsResult.usage.tier ?? null,
          } satisfies TtsUsageStats)
        : getTtsSettings().elevenLabsUsage;

    saveTtsSettings({
      provider: ttsProvider,
      apiKey: ttsApiKey,
      rate: Number(ttsRate),
      sourceBrowserVoiceURI,
      translationBrowserVoiceURI,
      sourceElevenLabsVoiceId,
      translationElevenLabsVoiceId,
      elevenLabsUsage: usage,
      elevenLabsUsageFetchedAt: usage ? Date.now() : null,
    });
    setTtsSaved(true);
    setTtsResult((current) => current ?? { success: true, message: t('Settings saved!') });
  }, [
    sourceBrowserVoiceURI,
    sourceElevenLabsVoiceId,
    translationBrowserVoiceURI,
    translationElevenLabsVoiceId,
    ttsApiKey,
    ttsProvider,
    ttsRate,
    ttsResult,
    t,
  ]);

  const handleClearTtsKey = useCallback(() => {
    clearTtsSettings();
    setTtsProvider('browser');
    setTtsApiKey('');
    setTtsRate('1');
    setTtsPersistKey(false);
    setTtsSaved(true);
    setTtsResult(null);
    setElevenLabsVoices([]);
    setSourceElevenLabsVoiceId(null);
    setTranslationElevenLabsVoiceId(null);
  }, []);

  useEffect(() => {
    if (!opened || !ttsApiKey.trim() || ttsProvider !== 'elevenlabs') return;
    void loadElevenLabsVoices();
  }, [loadElevenLabsVoices, opened, ttsApiKey, ttsProvider]);

  const ttsUsage = ttsResult?.usage;
  const ttsUsageExceeded = ttsUsage && ttsUsage.limit > 0 ? ttsUsage.used >= ttsUsage.limit : false;

  const downloadSettingsFile = useCallback(
    (includeApiKey: boolean) => {
      const file = createAppSettingsFile(
        {
          deepl: {
            apiKey,
            apiType,
            formality,
            persistKey,
          },
          preferences: {
            glossaryLocale: selectedLocale,
            glossaryEnforcementEnabled: enforcementEnabled,
            navSkipTranslated: skipTranslated,
            containerWidth,
            branchChipEnabled: isDevelopment ? branchChipEnabled : undefined,
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
          ? t('Settings exported with your DeepL API key.')
          : t('Settings exported without your DeepL API key.'),
      });
    },
    [
      apiKey,
      apiType,
      branchChipEnabled,
      containerWidth,
      enforcementEnabled,
      formality,
      isDevelopment,
      persistKey,
      selectedLocale,
      skipTranslated,
      t,
    ],
  );

  const applyImportedSettings = useCallback(
    (file: AppSettingsFile, includeApiKey: boolean) => {
      const applied = applyAppSettingsFile(file, { includeApiKey });
      const nextGlossaryLocale = applied.preferences.glossaryLocale;
      const shouldClearGlossary = glossary && glossary.targetLocale !== nextGlossaryLocale;

      setApiKey(applied.deepl.apiKey);
      setApiType(applied.deepl.apiType);
      setFormality(applied.deepl.formality);
      setPersistKey(applied.deepl.persistKey);
      setIsSaved(Boolean(applied.deepl.apiKey.trim()));
      setTestResult(null);
      setSelectedLocale(nextGlossaryLocale);

      if (shouldClearGlossary) {
        onGlossaryCleared?.();
        setHasAttemptedAutoLoad(false);
      }

      setEnforcementEnabled(applied.preferences.glossaryEnforcementEnabled);
      setSkipTranslated(applied.preferences.navSkipTranslated);
      onContainerWidthChange?.(applied.preferences.containerWidth);

      if (isDevelopment && typeof applied.preferences.branchChipEnabled === 'boolean') {
        onBranchChipEnabledChange?.(applied.preferences.branchChipEnabled);
      }

      setTransferResult({
        success: true,
        message:
          includeApiKey && settingsFileHasCredentials(file)
            ? t('Settings imported, including your DeepL API key.')
            : t('Settings imported without changing your current DeepL API key.'),
      });
    },
    [
      glossary,
      isDevelopment,
      onBranchChipEnabledChange,
      onContainerWidthChange,
      onGlossaryCleared,
      setSkipTranslated,
      t,
    ],
  );

  const handleExportClick = useCallback(() => {
    if (apiKey.trim()) {
      setCredentialPrompt({ mode: 'export' });
      return;
    }

    downloadSettingsFile(false);
  }, [apiKey, downloadSettingsFile]);

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

  const handleLoadGlossary = useCallback(
    async (forceRefresh = false) => {
      if (!selectedLocale) return;

      const token = ++loadTokenRef.current;
      setIsLoadingGlossary(true);
      setGlossaryError(null);

      try {
        const result: FetchResult = await fetchWPGlossary(selectedLocale, forceRefresh);
        if (loadTokenRef.current !== token) return;
        if (result.glossary) {
          onGlossaryLoaded?.(result.glossary);
          if (result.error) setGlossaryError(result.error);
        } else {
          setGlossaryError(result.error || t('Failed to load glossary'));
        }
      } catch (err) {
        if (loadTokenRef.current !== token) return;
        setGlossaryError(err instanceof Error ? err.message : t('Unknown error'));
      } finally {
        if (loadTokenRef.current === token) {
          setIsLoadingGlossary(false);
        }
      }
    },
    [selectedLocale, onGlossaryLoaded, t],
  );

  const handleClearGlossary = useCallback(() => {
    ++loadTokenRef.current; // invalidate any in-flight load
    if (selectedLocale) {
      clearWPGlossaryCache(selectedLocale);
    }
    setIsLoadingGlossary(false);
    setHasAttemptedAutoLoad(true); // Prevent auto-load from re-fetching after clear
    onGlossaryCleared?.();
  }, [selectedLocale, onGlossaryCleared]);

  const csvUploadResetRef = useRef<() => void>(null);
  const handleCsvUpload = useCallback(
    (file: File | null) => {
      if (!file || !selectedLocale) return;
      setGlossaryError(null);

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;

        if (!isValidGlossaryCSV(text)) {
          setGlossaryError(t('File does not appear to be a valid WordPress glossary CSV.'));
          csvUploadResetRef.current?.();
          return;
        }

        const parseResult = parseGlossaryCSV(text);
        if (parseResult.entries.length === 0) {
          setGlossaryError(
            parseResult.errors[0] || t('No glossary entries found in the uploaded file.'),
          );
          csvUploadResetRef.current?.();
          return;
        }

        const uploaded: Glossary = {
          sourceLocale: parseResult.sourceLocale || 'en',
          targetLocale: selectedLocale,
          project: 'wordpress',
          entries: parseResult.entries,
          fetchedAt: new Date().toISOString(),
        };

        onGlossaryLoaded?.(uploaded);
        csvUploadResetRef.current?.();
      };
      reader.onerror = () => {
        setGlossaryError(t('Failed to read the file.'));
        csvUploadResetRef.current?.();
      };
      reader.readAsText(file);
    },
    [selectedLocale, onGlossaryLoaded, t],
  );

  // Reset auto-load flag when locale changes
  useEffect(() => {
    setHasAttemptedAutoLoad(false);
  }, [selectedLocale]);

  // Auto-load glossary from cache on initial mount if we have a locale but no glossary
  useEffect(() => {
    if (selectedLocale && !glossary && !isLoadingGlossary && !hasAttemptedAutoLoad) {
      setHasAttemptedAutoLoad(true);
      // Try to load from cache (forceRefresh = false)
      handleLoadGlossary(false);
    }
  }, [selectedLocale, glossary, isLoadingGlossary, hasAttemptedAutoLoad, handleLoadGlossary]);

  return (
    <>
      <Modal opened={opened} onClose={onClose} title={t('Settings')} size="lg" centered>
        <Tabs defaultValue="api">
          <Tabs.List mb="md">
            <Tabs.Tab value="api" leftSection={<Key size={14} />}>
              {t('DeepL API')}
            </Tabs.Tab>
            <Tabs.Tab value="speech" leftSection={<Volume2 size={14} />}>
              {t('Speech')}
            </Tabs.Tab>
            <Tabs.Tab value="glossary" leftSection={<BookOpen size={14} />}>
              {t('Glossary')}
              {glossary && (
                <Badge size="xs" color="green" ml={6}>
                  {glossary.entries.length}
                </Badge>
              )}
            </Tabs.Tab>
            <Tabs.Tab value="keybinds" leftSection={<Keyboard size={14} />}>
              {t('Keyboard Shortcuts')}
            </Tabs.Tab>
            <Tabs.Tab value="display" leftSection={<Monitor size={14} />}>
              {t('Display')}
            </Tabs.Tab>
            <Tabs.Tab value="transfer" leftSection={<Download size={14} />}>
              {t('Backup')}
            </Tabs.Tab>
            {isDevelopment && (
              <Tabs.Tab
                value="development"
                leftSection={<GitBranch size={14} />}
                style={{
                  border: '1px dotted var(--mantine-color-orange-5)',
                  borderRadius: 'var(--mantine-radius-md)',
                }}
              >
                {t('Development')}
              </Tabs.Tab>
            )}
          </Tabs.List>

          {/* DeepL API Tab */}
          <Tabs.Panel value="api">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {t('Enter your DeepL API key to enable machine translation. Get a free key at')}{' '}
                <Anchor
                  href="https://www.deepl.com/pro-api"
                  target="_blank"
                  size="sm"
                  style={{
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  deepl.com/pro-api
                  <ExternalLink size={12} />
                </Anchor>
              </Text>

              <Alert color="yellow" icon={<AlertCircle size={16} />}>
                <Text size="sm">
                  {t(
                    'DeepL API is kept in this browser tab by default and will be cleared when you close the tab. Enable "Remember API key" below to persist it across sessions — only do this on a personal, trusted device.',
                  )}
                </Text>
              </Alert>

              <Switch
                label={t('Remember API key across sessions')}
                description={t(
                  'When enabled, your key is stored in localStorage and survives browser restarts. Disable on shared or untrusted devices.',
                )}
                checked={persistKey}
                onChange={(e) => {
                  const enabled = e.currentTarget.checked;
                  setPersistKey(enabled);
                  setPersistEnabled(enabled);
                  setIsSaved(false);
                }}
              />

              <PasswordInput
                label={t('API Key')}
                placeholder={t('Enter your DeepL API key')}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.currentTarget.value);
                  setIsSaved(false);
                  setTestResult(null);
                }}
                rightSection={
                  isSaved && apiKey ? (
                    <Tooltip label={t('Key saved')}>
                      <Check size={16} color="var(--mantine-color-green-6)" />
                    </Tooltip>
                  ) : null
                }
              />

              <div data-ev-id="ev_a06444cf83">
                <Text size="sm" fw={500} mb={4}>
                  {t('API Type')}
                </Text>
                <SegmentedControl
                  value={apiType}
                  onChange={(value) => {
                    setApiType(value as DeepLApiType);
                    setIsSaved(false);
                  }}
                  data={[
                    { label: t('Free API'), value: 'free' },
                    { label: t('Pro API'), value: 'pro' },
                  ]}
                  fullWidth
                />

                <Text size="xs" c="dimmed" mt={4}>
                  {t('Free: 500,000 chars/month • Pro: Pay per use')}
                </Text>
              </div>

              <div>
                <Text size="sm" fw={500} mb={4}>
                  {t('Formality')}
                </Text>
                <SegmentedControl
                  value={formality}
                  onChange={(value) => {
                    setFormality(value as DeepLFormality);
                    saveDeepLSettings({ formality: value as DeepLFormality });
                  }}
                  data={[
                    { label: t('Informal'), value: 'prefer_less' },
                    { label: t('Formal'), value: 'prefer_more' },
                  ]}
                  fullWidth
                />

                <Text size="xs" c="dimmed" mt={4}>
                  {t(
                    'Controls the tone of DeepL translations. Not all languages support formality.',
                  )}
                </Text>
              </div>

              <Group>
                <Button
                  variant="light"
                  onClick={handleTestKey}
                  loading={isTesting}
                  disabled={!apiKey.trim()}
                >
                  {t('Test Connection')}
                </Button>
                <Button onClick={handleSaveApiKey} disabled={!apiKey.trim() || isSaved}>
                  {t('Save')}
                </Button>
                {apiKey && (
                  <Button variant="subtle" color="red" onClick={handleClearApiKey}>
                    {t('Remove saved key')}
                  </Button>
                )}
              </Group>

              {testResult && (
                <Alert
                  color={testResult.success ? 'green' : 'red'}
                  icon={testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                >
                  <Stack gap="xs">
                    <Text size="sm">{testResult.message}</Text>
                    {testResult.usage && (
                      <>
                        <Progress
                          value={(testResult.usage.used / testResult.usage.limit) * 100}
                          size="sm"
                          color={
                            testResult.usage.used / testResult.usage.limit > 0.9 ? 'red' : 'blue'
                          }
                        />

                        <Text size="xs" c="dimmed">
                          {testResult.usage.used.toLocaleString()} /{' '}
                          {testResult.usage.limit.toLocaleString()} {t('characters')}
                        </Text>
                      </>
                    )}
                  </Stack>
                </Alert>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Speech Tab */}
          <Tabs.Panel value="speech">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {t(
                  'Play strings with either browser voices or ElevenLabs. Browser playback stays free and local. ElevenLabs uses your own API key through a protected proxy.',
                )}
              </Text>

              <Paper p="md" withBorder>
                <Stack gap="md">
                  <div>
                    <Text size="sm" fw={500} mb={4}>
                      {t('Provider')}
                    </Text>
                    <SegmentedControl
                      value={ttsProvider}
                      onChange={(value) => {
                        setTtsProvider(value as TtsProviderId);
                        setTtsSaved(false);
                        setTtsResult(null);
                      }}
                      data={[
                        { label: t('Browser'), value: 'browser' },
                        { label: 'ElevenLabs', value: 'elevenlabs' },
                      ]}
                      fullWidth
                    />
                  </div>

                  <div>
                    <Text size="sm" fw={500} mb={4}>
                      {t('Playback rate')}
                    </Text>
                    <SegmentedControl
                      value={ttsRate}
                      onChange={(value) => {
                        setTtsRate(value);
                        setTtsSaved(false);
                      }}
                      data={[
                        { label: '0.9x', value: '0.9' },
                        { label: '1.0x', value: '1' },
                        { label: '1.1x', value: '1.1' },
                      ]}
                      fullWidth
                    />
                  </div>

                  {ttsProvider === 'browser' ? (
                    <>
                      <Select
                        label={t('Source voice')}
                        placeholder={t('Use browser default')}
                        data={browserVoices.map((voice) => ({
                          value: voice.voiceURI,
                          label: `${voice.name} (${voice.lang})`,
                        }))}
                        value={sourceBrowserVoiceURI}
                        onChange={(value) => {
                          setSourceBrowserVoiceURI(value);
                          setTtsSaved(false);
                        }}
                        clearable
                        searchable
                      />

                      <Select
                        label={t('Translation voice')}
                        placeholder={t('Use browser default')}
                        data={browserVoices.map((voice) => ({
                          value: voice.voiceURI,
                          label: `${voice.name} (${voice.lang})`,
                        }))}
                        value={translationBrowserVoiceURI}
                        onChange={(value) => {
                          setTranslationBrowserVoiceURI(value);
                          setTtsSaved(false);
                        }}
                        clearable
                        searchable
                      />

                      <Group>
                        <Button onClick={handleSaveTtsSettings} disabled={ttsSaved}>
                          {t('Save')}
                        </Button>
                      </Group>
                    </>
                  ) : (
                    <>
                      <Alert color="yellow" icon={<AlertCircle size={16} />}>
                        <Text size="sm">
                          {t(
                            'Your ElevenLabs API key is kept in this browser tab by default and will be cleared when you close the tab. Enable "Remember API key" below to persist it across sessions.',
                          )}
                        </Text>
                      </Alert>

                      <Switch
                        label={t('Remember API key across sessions')}
                        description={t(
                          'When enabled, your key is stored in localStorage and survives browser restarts. Disable on shared or untrusted devices.',
                        )}
                        checked={ttsPersistKey}
                        onChange={(e) => {
                          const enabled = e.currentTarget.checked;
                          setTtsPersistKey(enabled);
                          setTtsPersistEnabled(enabled);
                          setTtsSaved(false);
                        }}
                      />

                      <PasswordInput
                        label={t('API Key')}
                        placeholder={t('Enter your ElevenLabs API key')}
                        value={ttsApiKey}
                        onChange={(e) => {
                          setTtsApiKey(e.currentTarget.value);
                          setTtsSaved(false);
                          setTtsResult(null);
                        }}
                        rightSection={
                          ttsSaved && ttsApiKey ? (
                            <Tooltip label={t('Key saved')}>
                              <Check size={16} color="var(--mantine-color-green-6)" />
                            </Tooltip>
                          ) : null
                        }
                      />

                      <Group>
                        <Button
                          variant="light"
                          onClick={handleTestTtsKey}
                          loading={ttsTesting}
                          disabled={!ttsApiKey.trim()}
                        >
                          {t('Test connection')}
                        </Button>
                        <Button
                          onClick={handleSaveTtsSettings}
                          disabled={!ttsApiKey.trim() || ttsSaved}
                        >
                          {t('Save')}
                        </Button>
                        {ttsApiKey && (
                          <Button variant="subtle" color="red" onClick={handleClearTtsKey}>
                            {t('Remove saved key')}
                          </Button>
                        )}
                      </Group>

                      {ttsResult && (
                        <Alert
                          color={ttsResult.success ? 'green' : 'red'}
                          icon={ttsResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                        >
                          <Stack gap="xs">
                            <Text size="sm">{ttsResult.message}</Text>
                            {ttsUsage && (
                              <>
                                {ttsUsage.limit > 0 && (
                                  <Progress
                                    value={(ttsUsage.used / ttsUsage.limit) * 100}
                                    size="sm"
                                    color={ttsUsage.used / ttsUsage.limit > 0.9 ? 'red' : 'blue'}
                                  />
                                )}
                                <Text size="xs" c="dimmed">
                                  {ttsUsage.used.toLocaleString()} /{' '}
                                  {ttsUsage.limit.toLocaleString()} {t('characters')}
                                  {ttsUsage.tier ? ` • ${ttsUsage.tier}` : ''}
                                </Text>
                                {ttsUsage.limit > 0 &&
                                  ttsUsage.used / ttsUsage.limit > 0.9 &&
                                  !ttsUsageExceeded && (
                                    <Text size="xs" c="red">
                                      {t(
                                        'Usage is above 90%. ElevenLabs playback will stop once the provider quota is exhausted.',
                                      )}
                                    </Text>
                                  )}
                                {ttsUsageExceeded && (
                                  <Text size="xs" c="red">
                                    {t(
                                      'ElevenLabs quota reached. Switch back to Browser playback or wait for the next provider reset.',
                                    )}
                                  </Text>
                                )}
                              </>
                            )}
                          </Stack>
                        </Alert>
                      )}

                      <Select
                        label={t('Source voice')}
                        placeholder={t('Load voices by testing your key')}
                        data={elevenLabsVoices.map((voice) => ({
                          value: voice.voiceId,
                          label: voice.name,
                        }))}
                        value={sourceElevenLabsVoiceId}
                        onChange={(value) => {
                          setSourceElevenLabsVoiceId(value);
                          setTtsSaved(false);
                        }}
                        disabled={elevenLabsVoices.length === 0 || ttsVoicesLoading}
                        searchable
                      />

                      <Select
                        label={t('Translation voice')}
                        placeholder={t('Load voices by testing your key')}
                        data={elevenLabsVoices.map((voice) => ({
                          value: voice.voiceId,
                          label: voice.name,
                        }))}
                        value={translationElevenLabsVoiceId}
                        onChange={(value) => {
                          setTranslationElevenLabsVoiceId(value);
                          setTtsSaved(false);
                        }}
                        disabled={elevenLabsVoices.length === 0 || ttsVoicesLoading}
                        searchable
                      />
                    </>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* Glossary Tab */}
          <Tabs.Panel value="glossary">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {t(
                  'Load the official WordPress translation glossary to ensure consistent terminology.',
                )}
              </Text>

              <Group align="flex-end" gap="sm">
                <Select
                  label={t('Language')}
                  placeholder={t('Select locale')}
                  data={COMMON_GLOSSARY_LOCALES}
                  value={selectedLocale}
                  onChange={(value) => setSelectedLocale(value || '')}
                  searchable
                  style={{ flex: 1 }}
                />

                {!glossary ? (
                  <Button
                    onClick={() => handleLoadGlossary(false)}
                    loading={isLoadingGlossary}
                    disabled={!selectedLocale}
                  >
                    {t('Load Glossary')}
                  </Button>
                ) : (
                  <Group gap="xs">
                    <Tooltip label={t('Refresh from WordPress.org')}>
                      <ActionIcon
                        variant="light"
                        size="lg"
                        onClick={() => handleLoadGlossary(true)}
                        loading={isLoadingGlossary}
                      >
                        <RefreshCw size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Button variant="subtle" color="gray" onClick={handleClearGlossary}>
                      {t('Clear')}
                    </Button>
                  </Group>
                )}
              </Group>

              {glossaryError && (
                <Alert color="red" icon={<AlertCircle size={16} />}>
                  {glossaryError}
                </Alert>
              )}

              <Divider label={t('or upload manually')} labelPosition="center" />

              <Group align="center" gap="sm">
                <FileButton
                  resetRef={csvUploadResetRef}
                  onChange={handleCsvUpload}
                  accept=".csv,text/csv"
                >
                  {(props) => (
                    <Button
                      variant="light"
                      leftSection={<Upload size={14} />}
                      disabled={!selectedLocale}
                      {...props}
                    >
                      {t('Upload CSV')}
                    </Button>
                  )}
                </FileButton>
                <Text size="xs" c="dimmed">
                  {t('Upload a WordPress glossary CSV for the selected language')}
                </Text>
              </Group>

              {glossary && (
                <Paper p="md" withBorder>
                  <Stack gap="sm">
                    {/* Header with stats */}
                    <Group justify="space-between">
                      <Group gap="xs">
                        <Badge color="green" variant="light">
                          {glossary.entries.length} {t('terms')}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          ({glossary.targetLocale})
                        </Text>
                      </Group>

                      <Button
                        variant="subtle"
                        size="xs"
                        leftSection={<Eye size={14} />}
                        onClick={() => setViewerOpened(true)}
                      >
                        {t('View All')}
                      </Button>
                    </Group>

                    {/* DeepL sync status */}
                    <Group gap="xs">
                      {syncStatus?.includes('Syncing') ? (
                        <>
                          <Loader size={12} />
                          <Text size="xs" c="dimmed">
                            {t('Syncing to DeepL...')}
                          </Text>
                        </>
                      ) : deeplGlossaryId ? (
                        <>
                          <Check size={12} color="var(--mantine-color-green-6)" />
                          <Text size="xs" c="green">
                            {deeplTermCount
                              ? t('DeepL ready ({count} terms)', { count: deeplTermCount })
                              : t('DeepL ready')}
                          </Text>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => onForceResync?.(glossary)}
                          >
                            {t('Resync')}
                          </Button>
                        </>
                      ) : syncStatus?.includes('failed') ? (
                        <>
                          <X size={12} color="var(--mantine-color-red-6)" />
                          <Text size="xs" c="red">
                            {t('Sync failed')}
                          </Text>
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            onClick={() => onGlossaryLoaded?.(glossary)}
                          >
                            {t('Retry')}
                          </Button>
                        </>
                      ) : null}
                    </Group>

                    <Divider />

                    {/* Enforcement toggle */}
                    <Switch
                      label={t('Use glossary for translations')}
                      description={t('DeepL will enforce glossary terms in machine translations')}
                      checked={enforcementEnabled}
                      onChange={(e) => setEnforcementEnabled(e.currentTarget.checked)}
                      styles={{
                        track: {
                          transition: 'background-color 0.2s ease, border-color 0.2s ease',
                        },
                        thumb: {
                          transition: 'transform 0.2s ease, left 0.2s ease',
                        },
                      }}
                    />

                    {/* Selected text term preview */}
                    {selectedSourceText && (
                      <>
                        <Divider />
                        <div data-ev-id="ev_898c72be1c">
                          <Text size="xs" fw={500} mb={4}>
                            {t('Terms in selected text:')}
                          </Text>
                          <GlossaryTermsPreview
                            sourceText={selectedSourceText}
                            glossary={glossary}
                          />
                        </div>
                      </>
                    )}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Keyboard Shortcuts Tab */}
          <Tabs.Panel value="keybinds">
            <KeyboardShortcutsPanel
              skipTranslated={skipTranslated}
              onSkipTranslatedChange={setSkipTranslated}
            />
          </Tabs.Panel>

          {/* Display Tab */}
          <Tabs.Panel value="display">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {t('Adjust the appearance of the editor to suit your screen and preferences.')}
              </Text>

              <Paper p="md" withBorder>
                <Stack gap="sm">
                  <div>
                    <Text size="sm" fw={500}>
                      {t('Interface language')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('Choose which language GlossBoss uses for its interface.')}
                    </Text>
                  </div>

                  <Select
                    aria-label={t('Interface language')}
                    value={language}
                    onChange={(value) => {
                      if (value) {
                        setLanguage(value as AppLanguage);
                      }
                    }}
                    data={APP_LANGUAGE_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    }))}
                    leftSection={<Languages size={14} />}
                    allowDeselect={false}
                  />

                  <Text size="xs" c="dimmed">
                    {t('Want to help translate GlossBoss?')}{' '}
                    <Anchor href="/translate/" target="_blank" rel="noopener noreferrer">
                      {t('Read the translation guide')}
                    </Anchor>
                  </Text>
                </Stack>
              </Paper>

              <Paper p="md" withBorder>
                <Stack gap="sm">
                  <div>
                    <Text size="sm" fw={500}>
                      {t('Container width')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t(
                        'Controls the maximum width of the main content area. Use a wider setting on large monitors, or full width to use all available space.',
                      )}
                    </Text>
                  </div>

                  <SegmentedControl
                    value={containerWidth}
                    onChange={(value) => onContainerWidthChange?.(value as ContainerWidth)}
                    data={CONTAINER_WIDTH_OPTIONS.map((opt) => ({
                      value: opt.value,
                      label: opt.label,
                    }))}
                    fullWidth
                    size="xs"
                  />
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="transfer">
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                {t(
                  'Export your saved preferences to a JSON backup file, or restore them into this browser. Glossary cache, drafts, and project files are not included.',
                )}
              </Text>

              <Paper p="md" withBorder>
                <Stack gap="sm">
                  <div>
                    <Text size="sm" fw={500}>
                      {t('Settings file')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t(
                        'Exports DeepL preferences, glossary options, navigation behavior, display width, and development-only toggles. If a DeepL API key is present, you can choose whether to include it.',
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

              {transferResult && (
                <Alert
                  color={transferResult.success ? 'green' : 'red'}
                  icon={transferResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                >
                  <Text size="sm">{transferResult.message}</Text>
                </Alert>
              )}
            </Stack>
          </Tabs.Panel>

          {isDevelopment && (
            <Tabs.Panel value="development">
              <Stack gap="md">
                <Alert color="orange" variant="light" icon={<GitBranch size={16} />}>
                  <Text size="sm" fw={600}>
                    {t('Development Mode Only')}
                  </Text>
                  <Text size="sm">
                    {t(
                      'These tools only appear while running the app locally in development and are not shown in production.',
                    )}
                  </Text>
                </Alert>

                <Paper p="md" withBorder>
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text size="sm" fw={500}>
                          {t('Branch status chip')}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {t(
                            'Show the current git branch in a small floating chip at the bottom right of the site.',
                          )}
                        </Text>
                      </div>

                      <Badge variant="light" color="gray">
                        {__GIT_BRANCH__}
                      </Badge>
                    </Group>

                    <Switch
                      label={t('Show branch chip')}
                      description={t('Only visible while running the app in development mode')}
                      checked={branchChipEnabled}
                      onChange={(e) => onBranchChipEnabledChange?.(e.currentTarget.checked)}
                      styles={{
                        track: {
                          transition: 'background-color 0.2s ease, border-color 0.2s ease',
                        },
                        thumb: {
                          transition: 'transform 0.2s ease, left 0.2s ease',
                        },
                      }}
                    />
                  </Stack>
                </Paper>
              </Stack>
            </Tabs.Panel>
          )}
        </Tabs>
      </Modal>

      {/* Glossary viewer modal */}
      {glossary && (
        <GlossaryViewerModal
          glossary={glossary}
          opened={viewerOpened}
          onClose={() => setViewerOpened(false)}
        />
      )}

      <Modal
        opened={credentialPrompt !== null}
        onClose={() => setCredentialPrompt(null)}
        title={credentialPrompt?.mode === 'import' ? t('Import API key?') : t('Include API key?')}
        centered
        size="sm"
      >
        <Stack gap="md">
          <Alert color="yellow" icon={<AlertCircle size={16} />}>
            <Text size="sm">
              {credentialPrompt?.mode === 'import'
                ? t('This settings file contains your DeepL API key in plain text.')
                : t(
                    'Including your DeepL API key will store it in plain text inside the exported JSON file.',
                  )}
            </Text>
          </Alert>

          <Text size="sm">
            {credentialPrompt?.mode === 'import'
              ? t('Choose whether to import the key or keep the current key saved in this browser.')
              : t(
                  'Choose whether to export the key or keep the settings file free of credentials.',
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
                : t('Export without key')}
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
              {credentialPrompt?.mode === 'import' ? t('Import key') : t('Include key')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
