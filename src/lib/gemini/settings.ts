import { createPersistenceManager } from '@/lib/settings/storage-persistence';
import { GEMINI_SETTINGS_KEY, GEMINI_PERSIST_KEY } from '@/lib/constants/storage-keys';

const DEFAULT_MODEL = 'gemini-flash-lite-latest';

export interface GeminiSettings {
  apiKey: string;
  modelId: string;
  useProjectContext: boolean;
  updatedAt: number;
}

const DEFAULT_SETTINGS: GeminiSettings = {
  apiKey: '',
  modelId: DEFAULT_MODEL,
  useProjectContext: false,
  updatedAt: 0,
};

const manager = createPersistenceManager<GeminiSettings>({
  storageKey: GEMINI_SETTINGS_KEY,
  persistKey: GEMINI_PERSIST_KEY,
  defaults: DEFAULT_SETTINGS,
  label: 'Gemini Settings',
  parse: (raw) => ({
    apiKey: typeof raw.apiKey === 'string' ? (raw.apiKey as string) : '',
    modelId:
      typeof raw.modelId === 'string' && (raw.modelId as string).trim()
        ? (raw.modelId as string).trim()
        : DEFAULT_MODEL,
    useProjectContext: Boolean(raw.useProjectContext),
    updatedAt: typeof raw.updatedAt === 'number' ? (raw.updatedAt as number) : 0,
  }),
});

export function isGeminiPersistEnabled(): boolean {
  return manager.isPersistEnabled();
}

export function setGeminiPersistEnabled(enabled: boolean): void {
  manager.setPersistEnabled(enabled);
}

export function getGeminiSettings(): GeminiSettings {
  return manager.get();
}

export function saveGeminiSettings(settings: Partial<GeminiSettings>): void {
  manager.save(settings);
}

export function clearGeminiSettings(): void {
  manager.clear();
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiSettings().apiKey.trim());
}

export function getDefaultGeminiModel(): string {
  return DEFAULT_MODEL;
}
