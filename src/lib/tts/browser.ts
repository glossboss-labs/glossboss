import { getTtsSettings } from './settings';
import type { TtsPlaybackKind } from './types';

export function isBrowserTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getBrowserVoices(): SpeechSynthesisVoice[] {
  if (!isBrowserTtsSupported()) return [];
  return window.speechSynthesis.getVoices();
}

export function resolveBrowserVoice(voiceURI: string | null): SpeechSynthesisVoice | null {
  if (!voiceURI) return null;
  return getBrowserVoices().find((voice) => voice.voiceURI === voiceURI) ?? null;
}

export function selectVoiceForLanguage(
  voices: SpeechSynthesisVoice[],
  lang: string | null,
  preferredVoiceURI?: string | null,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const preferredVoice = preferredVoiceURI
    ? voices.find((voice) => voice.voiceURI === preferredVoiceURI)
    : null;
  if (preferredVoice) return preferredVoice;

  if (!lang) {
    return voices.find((voice) => voice.default) ?? voices[0] ?? null;
  }

  const normalizedLang = lang.toLowerCase();
  const exact = voices.find((voice) => voice.lang.toLowerCase() === normalizedLang);
  if (exact) return exact;

  const baseLang = normalizedLang.split('-')[0];
  const base = voices.find((voice) => voice.lang.toLowerCase() === baseLang);
  if (base) return base;

  const partial = voices.find((voice) => voice.lang.toLowerCase().startsWith(`${baseLang}-`));
  if (partial) return partial;

  return voices.find((voice) => voice.default) ?? voices[0] ?? null;
}

export function getPreferredBrowserVoiceURI(kind: TtsPlaybackKind): string | null {
  const settings = getTtsSettings();
  return kind === 'source' ? settings.sourceBrowserVoiceURI : settings.translationBrowserVoiceURI;
}
