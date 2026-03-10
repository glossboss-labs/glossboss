import { useSyncExternalStore } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { Volume2, Square, AlertTriangle } from 'lucide-react';
import {
  buildPlaybackId,
  getPlaybackSnapshot,
  getTtsSettings,
  isBrowserTtsSupported,
  isElevenLabsQuotaExceeded,
  subscribeToPlayback,
  subscribeToTtsSettings,
  togglePlayback,
} from '@/lib/tts';
import type { TtsPlaybackKind } from '@/lib/tts';
import { useTranslation } from '@/lib/app-language';

export interface SpeakButtonProps {
  text: string;
  lang: string | null;
  kind: TtsPlaybackKind;
  entryId: string;
}

export function SpeakButton({ text, lang, kind, entryId }: SpeakButtonProps) {
  const { t } = useTranslation();
  const playback = useSyncExternalStore(
    subscribeToPlayback,
    getPlaybackSnapshot,
    getPlaybackSnapshot,
  );
  const settings = useSyncExternalStore(subscribeToTtsSettings, getTtsSettings, getTtsSettings);
  const playbackId = buildPlaybackId(kind, entryId);
  const isPlaying = playback.activeId === playbackId && playback.status === 'playing';
  const usageExceeded = isElevenLabsQuotaExceeded(settings.elevenLabsUsage);

  const getDisabledReason = (): string | null => {
    if (!text.trim()) {
      return kind === 'translation' ? t('Nothing to play yet.') : t('No text to play.');
    }
    if (settings.provider === 'elevenlabs' && usageExceeded) {
      return t('ElevenLabs quota reached.');
    }
    if (settings.provider === 'browser' && !isBrowserTtsSupported()) {
      return t('Speech synthesis is not available in this browser.');
    }
    return null;
  };

  const disabledReason = getDisabledReason();
  const hasError = playback.activeId === playbackId && !!playback.error;
  const tooltip =
    disabledReason ??
    (hasError
      ? playback.error
      : isPlaying
        ? t('Stop playback')
        : kind === 'source'
          ? t('Play source')
          : t('Play translation'));

  if (settings.provider === 'browser' && !isBrowserTtsSupported()) {
    return null;
  }

  const icon = hasError ? (
    <AlertTriangle size={14} />
  ) : isPlaying ? (
    <Square size={14} />
  ) : (
    <Volume2 size={14} />
  );

  return (
    <Tooltip label={tooltip}>
      <ActionIcon
        variant="default"
        size="sm"
        color={hasError ? 'red' : undefined}
        aria-label={isPlaying ? t('Stop playback') : t('Play')}
        onClick={() => {
          if (disabledReason) return;
          void togglePlayback({ text, lang, kind, entryId });
        }}
        disabled={Boolean(disabledReason)}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
