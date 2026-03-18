/**
 * Speech Section — TTS provider selector, API key, voice selection,
 * rate control, and test playback.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Stack,
  PasswordInput,
  Button,
  Group,
  Text,
  Alert,
  SegmentedControl,
  Progress,
  Select,
  Switch,
  Paper,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { Check, AlertCircle, Play } from 'lucide-react';
import {
  clearTtsSettings,
  getBrowserVoices,
  getElevenLabsClient,
  getTtsSettings,
  isBrowserTtsSupported,
  isTtsPersistEnabled,
  primeElevenLabsVoices,
  resolveBrowserVoice,
  saveTtsSettings,
  saveTtsUsage,
  setTtsPersistEnabled,
  stopPlayback,
  type TtsProviderId,
  type TtsUsageStats,
  type TtsVoiceSummary,
} from '@/lib/tts';
import { useTranslation } from '@/lib/app-language';

export interface SpeechSectionProps {
  speechEnabled?: boolean;
  onSpeechEnabledChange?: (enabled: boolean) => void;
}

export function SpeechSection({ speechEnabled = true, onSpeechEnabledChange }: SpeechSectionProps) {
  const { t } = useTranslation();

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

  // Load saved settings on mount
  useEffect(() => {
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
  }, [t]);

  // Load browser voices
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

  const loadElevenLabsVoices = useCallback(async () => {
    setTtsVoicesLoading(true);

    try {
      const voices = await getElevenLabsClient().listVoices();
      setElevenLabsVoices(voices);
      if (voices.length > 0) {
        setSourceElevenLabsVoiceId((current) => current ?? voices[0]!.voiceId);
        setTranslationElevenLabsVoiceId((current) => current ?? voices[0]!.voiceId);
      }
      primeElevenLabsVoices(voices);
    } catch (error) {
      console.warn('[TTS] Failed to load ElevenLabs voices:', error);
    } finally {
      setTtsVoicesLoading(false);
    }
  }, []);

  // Auto-load ElevenLabs voices when provider is elevenlabs and key is set
  useEffect(() => {
    if (!ttsApiKey.trim() || ttsProvider !== 'elevenlabs') return;
    void loadElevenLabsVoices();
  }, [loadElevenLabsVoices, ttsApiKey, ttsProvider]);

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

  const previewBrowserVoice = useCallback(
    (voiceURI: string | null) => {
      if (!isBrowserTtsSupported()) return;
      stopPlayback();
      const utterance = new SpeechSynthesisUtterance(t('This is a preview of the selected voice.'));
      utterance.rate = Number(ttsRate);
      const voice = resolveBrowserVoice(voiceURI);
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      window.speechSynthesis.speak(utterance);
    },
    [ttsRate, t],
  );

  const previewElevenLabsVoice = useCallback(
    (voiceId: string | null) => {
      if (!voiceId) return;
      const voice = elevenLabsVoices.find((v) => v.voiceId === voiceId);
      if (!voice?.previewUrl) return;
      stopPlayback();
      const audio = new Audio(voice.previewUrl);
      audio.playbackRate = Number(ttsRate);
      void audio.play();
    },
    [elevenLabsVoices, ttsRate],
  );

  const ttsUsage = ttsResult?.usage;
  const ttsUsageExceeded = ttsUsage && ttsUsage.limit > 0 ? ttsUsage.used >= ttsUsage.limit : false;

  return (
    <Stack gap="md">
      <Switch
        label={t('Enable speech playback')}
        description={t('When disabled, all speak buttons are hidden from the editor.')}
        checked={speechEnabled}
        onChange={(e) => onSpeechEnabledChange?.(e.currentTarget.checked)}
      />

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
              <Group align="end" gap="xs">
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
                  style={{ flex: 1 }}
                />
                <Tooltip label={t('Preview voice')}>
                  <ActionIcon
                    variant="default"
                    size="lg"
                    onClick={() => previewBrowserVoice(sourceBrowserVoiceURI)}
                  >
                    <Play size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>

              <Group align="end" gap="xs">
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
                  style={{ flex: 1 }}
                />
                <Tooltip label={t('Preview voice')}>
                  <ActionIcon
                    variant="default"
                    size="lg"
                    onClick={() => previewBrowserVoice(translationBrowserVoiceURI)}
                  >
                    <Play size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>

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
                label={t('API key')}
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
                <Button onClick={handleSaveTtsSettings} disabled={!ttsApiKey.trim() || ttsSaved}>
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
                          {ttsUsage.used.toLocaleString()} / {ttsUsage.limit.toLocaleString()}{' '}
                          {t('characters')}
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

              <Group align="end" gap="xs">
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
                  style={{ flex: 1 }}
                />
                <Tooltip label={t('Preview voice')}>
                  <ActionIcon
                    variant="default"
                    size="lg"
                    disabled={!sourceElevenLabsVoiceId}
                    onClick={() => previewElevenLabsVoice(sourceElevenLabsVoiceId)}
                  >
                    <Play size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>

              <Group align="end" gap="xs">
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
                  style={{ flex: 1 }}
                />
                <Tooltip label={t('Preview voice')}>
                  <ActionIcon
                    variant="default"
                    size="lg"
                    disabled={!translationElevenLabsVoiceId}
                    onClick={() => previewElevenLabsVoice(translationElevenLabsVoiceId)}
                  >
                    <Play size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
