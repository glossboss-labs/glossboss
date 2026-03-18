import { createPersistenceManager } from '@/lib/settings/storage-persistence';
import { AZURE_SETTINGS_KEY, AZURE_PERSIST_KEY } from '@/lib/constants/storage-keys';

const DEFAULT_ENDPOINT = 'https://api.cognitive.microsofttranslator.com';

export interface AzureSettings {
  apiKey: string;
  region: string;
  endpoint: string;
  updatedAt: number;
}

const DEFAULT_SETTINGS: AzureSettings = {
  apiKey: '',
  region: '',
  endpoint: DEFAULT_ENDPOINT,
  updatedAt: 0,
};

const manager = createPersistenceManager<AzureSettings>({
  storageKey: AZURE_SETTINGS_KEY,
  persistKey: AZURE_PERSIST_KEY,
  defaults: DEFAULT_SETTINGS,
  label: 'Azure Settings',
  parse: (raw) => ({
    apiKey: typeof raw.apiKey === 'string' ? (raw.apiKey as string) : '',
    region: typeof raw.region === 'string' ? (raw.region as string) : '',
    endpoint:
      typeof raw.endpoint === 'string' && (raw.endpoint as string).trim()
        ? (raw.endpoint as string).trim()
        : DEFAULT_ENDPOINT,
    updatedAt: typeof raw.updatedAt === 'number' ? (raw.updatedAt as number) : 0,
  }),
});

export function isAzurePersistEnabled(): boolean {
  return manager.isPersistEnabled();
}

export function setAzurePersistEnabled(enabled: boolean): void {
  manager.setPersistEnabled(enabled);
}

export function getAzureSettings(): AzureSettings {
  return manager.get();
}

export function saveAzureSettings(settings: Partial<AzureSettings>): void {
  manager.save(settings);
}

export function clearAzureSettings(): void {
  manager.clear();
}

export function hasAzureApiKey(): boolean {
  const settings = getAzureSettings();
  return Boolean(settings.apiKey.trim() && settings.region.trim());
}

export function getDefaultAzureEndpoint(): string {
  return DEFAULT_ENDPOINT;
}
