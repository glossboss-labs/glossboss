export type TtsProviderId = 'browser' | 'elevenlabs';
export type TtsPlaybackKind = 'source' | 'translation';

export interface TtsUsageStats {
  characterCount: number;
  characterLimit: number;
  tier?: string | null;
  status?: string | null;
  nextResetUnix?: number | null;
}

export interface TtsVoiceSummary {
  voiceId: string;
  name: string;
  labels?: Record<string, string>;
  previewUrl?: string | null;
}

export interface TtsSettings {
  enabled: boolean;
  provider: TtsProviderId;
  apiKey: string;
  rate: number;
  updatedAt: number;
  sourceBrowserVoiceURI: string | null;
  translationBrowserVoiceURI: string | null;
  sourceElevenLabsVoiceId: string | null;
  translationElevenLabsVoiceId: string | null;
  elevenLabsUsage: TtsUsageStats | null;
  elevenLabsUsageFetchedAt: number | null;
}

export interface TtsSpeakRequest {
  text: string;
  lang: string | null;
  kind: TtsPlaybackKind;
  entryId: string;
}
