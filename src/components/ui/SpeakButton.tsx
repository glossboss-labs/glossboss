import { useSyncExternalStore } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { Volume2, Square } from 'lucide-react';
import {
  getPlaybackSnapshot,
  getTtsSettings,
  isBrowserTtsSupported,
  isElevenLabsQuotaExceeded,
  subscribeToPlayback,
  subscribeToTtsSettings,
  togglePlayback,
} from '@/lib/tts';
import type { TtsPlaybackKind } from '@/lib/tts';

export interface SpeakButtonProps {
  text: string;
  lang: string | null;
  kind: TtsPlaybackKind;
  entryId: string;
}

function buildPlaybackId(kind: TtsPlaybackKind, entryId: string, text: string): string {
  return `${kind}:${entryId}:${text}`;
}

function getDisabledReason(
  text: string,
  kind: TtsPlaybackKind,
  provider: 'browser' | 'elevenlabs',
  usageExceeded: boolean,
): string | null {
  if (!text.trim()) {
    return kind === 'translation' ? 'Nothing to play yet.' : 'No text to play.';
  }
  if (provider === 'elevenlabs' && usageExceeded) {
    return 'ElevenLabs quota reached.';
  }
  if (provider === 'browser' && !isBrowserTtsSupported()) {
    return 'Speech synthesis is not available in this browser.';
  }

  return null;
}

export function SpeakButton({ text, lang, kind, entryId }: SpeakButtonProps) {
  const playback = useSyncExternalStore(
    subscribeToPlayback,
    getPlaybackSnapshot,
    getPlaybackSnapshot,
  );
  const settings = useSyncExternalStore(subscribeToTtsSettings, getTtsSettings, getTtsSettings);
  const playbackId = buildPlaybackId(kind, entryId, text);
  const isPlaying = playback.activeId === playbackId && playback.status === 'playing';
  const usageExceeded = isElevenLabsQuotaExceeded(settings.elevenLabsUsage);
  const disabledReason = getDisabledReason(text, kind, settings.provider, usageExceeded);
  const tooltip =
    disabledReason ??
    (isPlaying ? `Stop ${kind} playback` : `Play ${kind === 'source' ? 'source' : 'translation'}`);

  if (settings.provider === 'browser' && !isBrowserTtsSupported()) {
    return null;
  }

  return (
    <Tooltip label={tooltip}>
      <ActionIcon
        variant="default"
        size="sm"
        aria-label={isPlaying ? `Stop ${kind}` : `Play ${kind}`}
        onClick={() => {
          if (disabledReason) return;
          void togglePlayback({ text, lang, kind, entryId });
        }}
        disabled={Boolean(disabledReason)}
      >
        {isPlaying ? <Square size={14} /> : <Volume2 size={14} />}
      </ActionIcon>
    </Tooltip>
  );
}
