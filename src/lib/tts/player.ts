import { getElevenLabsClient } from './client';
import { getBrowserVoices, isBrowserTtsSupported, selectVoiceForLanguage } from './browser';
import {
  getTtsSettings,
  isElevenLabsQuotaExceeded,
  saveTtsSettings,
  saveTtsUsage,
} from './settings';
import type { TtsPlaybackKind, TtsSpeakRequest } from './types';

type PlaybackStatus = 'idle' | 'playing';

interface PlaybackSnapshot {
  activeId: string | null;
  status: PlaybackStatus;
  error: string | null;
}

const listeners = new Set<() => void>();
let snapshot: PlaybackSnapshot = {
  activeId: null,
  status: 'idle',
  error: null,
};
let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setSnapshot(next: PlaybackSnapshot): void {
  snapshot = next;
  emit();
}

export function buildPlaybackId(kind: TtsPlaybackKind, entryId: string): string {
  return `${kind}:${entryId}`;
}

function cleanupAudio(): void {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = '';
    activeAudio = null;
  }
  if (activeAudioUrl) {
    URL.revokeObjectURL(activeAudioUrl);
    activeAudioUrl = null;
  }
}

export function subscribeToPlayback(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPlaybackSnapshot(): PlaybackSnapshot {
  return snapshot;
}

export function stopPlayback(): void {
  cleanupAudio();
  activeUtterance = null;

  if (isBrowserTtsSupported()) {
    window.speechSynthesis.cancel();
  }
  setSnapshot({
    activeId: null,
    status: 'idle',
    error: null,
  });
}

async function refreshUsageInBackground(): Promise<void> {
  try {
    const usage = await getElevenLabsClient().getUsage();
    saveTtsUsage(usage);
  } catch {
    // Keep the last known usage if refresh fails.
  }
}

function getSelectedVoiceId(kind: TtsPlaybackKind): string | null {
  const settings = getTtsSettings();
  return kind === 'source'
    ? settings.sourceElevenLabsVoiceId
    : settings.translationElevenLabsVoiceId;
}

function getSelectedVoiceUri(kind: TtsPlaybackKind): string | null {
  const settings = getTtsSettings();
  return kind === 'source' ? settings.sourceBrowserVoiceURI : settings.translationBrowserVoiceURI;
}

async function playWithElevenLabs(request: TtsSpeakRequest, playbackId: string): Promise<void> {
  const settings = getTtsSettings();
  if (!settings.apiKey.trim()) {
    throw new Error('Configure your ElevenLabs API key in Settings.');
  }
  if (isElevenLabsQuotaExceeded(settings.elevenLabsUsage)) {
    throw new Error('ElevenLabs quota reached.');
  }

  const voiceId =
    getSelectedVoiceId(request.kind) ??
    settings.translationElevenLabsVoiceId ??
    settings.sourceElevenLabsVoiceId;
  if (!voiceId) {
    throw new Error('Select an ElevenLabs voice in Settings.');
  }

  setSnapshot({ activeId: playbackId, status: 'playing', error: null });

  const blob = await getElevenLabsClient().speak({
    voiceId,
    text: request.text,
    modelId: 'eleven_multilingual_v2',
    languageCode: request.lang,
  });

  if (snapshot.activeId !== playbackId) return;

  cleanupAudio();

  const audioUrl = URL.createObjectURL(blob);
  const audio = new Audio(audioUrl);
  activeAudio = audio;
  activeAudioUrl = audioUrl;

  audio.onended = () => {
    if (activeAudio !== audio) return;
    cleanupAudio();
    setSnapshot({ activeId: null, status: 'idle', error: null });
  };
  audio.onerror = () => {
    if (activeAudio !== audio) return;
    cleanupAudio();
    setSnapshot({
      activeId: null,
      status: 'idle',
      error: 'Playback failed.',
    });
  };

  await audio.play();
  void refreshUsageInBackground();
}

function playWithBrowser(request: TtsSpeakRequest, playbackId: string): void {
  if (!isBrowserTtsSupported()) {
    throw new Error('Speech synthesis is not available in this browser.');
  }

  const utterance = new SpeechSynthesisUtterance(request.text);
  const settings = getTtsSettings();
  utterance.rate = settings.rate;
  if (request.lang) {
    utterance.lang = request.lang;
  }

  const voice = selectVoiceForLanguage(
    getBrowserVoices(),
    request.lang,
    getSelectedVoiceUri(request.kind),
  );
  if (voice) {
    utterance.voice = voice;
    if (!request.lang) {
      utterance.lang = voice.lang;
    }
  }

  utterance.onend = () => {
    if (activeUtterance !== utterance) return;
    activeUtterance = null;
    setSnapshot({ activeId: null, status: 'idle', error: null });
  };
  utterance.onerror = () => {
    if (activeUtterance !== utterance) return;
    activeUtterance = null;
    setSnapshot({
      activeId: null,
      status: 'idle',
      error: 'Speech synthesis failed.',
    });
  };

  activeUtterance = utterance;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  setSnapshot({
    activeId: playbackId,
    status: 'playing',
    error: null,
  });
}

export async function togglePlayback(request: TtsSpeakRequest): Promise<void> {
  const playbackId = buildPlaybackId(request.kind, request.entryId);

  if (snapshot.activeId === playbackId && snapshot.status === 'playing') {
    stopPlayback();
    return;
  }

  stopPlayback();

  const settings = getTtsSettings();
  if (!settings.enabled) {
    return;
  }

  try {
    if (settings.provider === 'elevenlabs') {
      await playWithElevenLabs(request, playbackId);
      return;
    }

    playWithBrowser(request, playbackId);
  } catch (error) {
    setSnapshot({
      activeId: playbackId,
      status: 'idle',
      error: error instanceof Error ? error.message : 'Playback failed.',
    });
  }
}

export function primeElevenLabsVoices(
  prefetchedVoices?: { voiceId: string; name: string }[],
): void {
  const settings = getTtsSettings();
  if (!settings.apiKey.trim()) return;

  const voices = prefetchedVoices ?? [];
  if (voices.length === 0) return;

  if (!settings.sourceElevenLabsVoiceId || !settings.translationElevenLabsVoiceId) {
    saveTtsSettings({
      sourceElevenLabsVoiceId: settings.sourceElevenLabsVoiceId ?? voices[0].voiceId,
      translationElevenLabsVoiceId: settings.translationElevenLabsVoiceId ?? voices[0].voiceId,
    });
  }
}
