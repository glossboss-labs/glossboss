/**
 * Translation Section — credential manager with card-per-provider layout.
 *
 * Shows all providers at a glance with status badges and a default indicator.
 * Expanding a card reveals API key input, provider-specific settings, test/save/remove.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Stack,
  PasswordInput,
  Button,
  Group,
  Text,
  TextInput,
  Alert,
  SegmentedControl,
  Progress,
  Switch,
  Tooltip,
  Anchor,
  Paper,
  Badge,
  Collapse,
  UnstyledButton,
  Divider,
} from '@mantine/core';
import {
  Check,
  AlertCircle,
  ExternalLink,
  Shield,
  Star,
  ChevronDown,
  ChevronRight,
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
  clearAzureSettings,
  getAzureClient,
  getAzureSettings,
  getDefaultAzureEndpoint,
  isAzurePersistEnabled,
  saveAzureSettings,
  setAzurePersistEnabled,
} from '@/lib/azure';
import {
  getTranslationProviderSettings,
  getTranslationUsage,
  saveActiveTranslationProvider,
  hasProviderCredentials,
  type TranslationProviderId,
} from '@/lib/translation';
import { LLM_PROVIDERS } from '@/lib/llm';
import { useTranslation } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';
import { LlmProviderCard } from './LlmProviderCard';
import { CustomProviderCard } from './CustomProviderCard';

interface ConnectionResult {
  success: boolean;
  message: string;
  usage?: { used: number; limit: number };
}

export interface TranslationSectionProps {
  translateEnabled?: boolean;
  onTranslateEnabledChange?: (enabled: boolean) => void;
}

/** Mask an API key for display: show last 4 chars. */
function maskKey(key: string): string {
  if (!key || key.length <= 4) return key ? '****' : '';
  return '****' + key.slice(-4);
}

export function TranslationSection({
  translateEnabled = true,
  onTranslateEnabledChange,
}: TranslationSectionProps) {
  const { t } = useTranslation();

  // Global default provider
  const [defaultProvider, setDefaultProvider] = useState<TranslationProviderId>('deepl');
  // Which card is expanded
  const [expandedCard, setExpandedCard] = useState<TranslationProviderId | null>(null);

  // ── DeepL state ──
  const [apiKey, setApiKey] = useState('');
  const [apiType, setApiType] = useState<DeepLApiType>('free');
  const [formality, setFormality] = useState<DeepLFormality>('prefer_less');
  const [persistKey, setPersistKeyState] = useState(() => isPersistEnabled());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // ── Azure state ──
  const [azureApiKey, setAzureApiKey] = useState('');
  const [azureRegion, setAzureRegion] = useState('');
  const [azureEndpoint, setAzureEndpoint] = useState(getDefaultAzureEndpoint());
  const [azurePersistKey, setAzurePersistKey] = useState(() => isAzurePersistEnabled());
  const [azureTesting, setAzureTesting] = useState(false);
  const [azureSaved, setAzureSaved] = useState(false);
  const [azureTestResult, setAzureTestResult] = useState<ConnectionResult | null>(null);

  // Load all settings on mount
  useEffect(() => {
    setDefaultProvider(getTranslationProviderSettings().provider);

    const dl = getDeepLSettings();
    setApiKey(dl.apiKey);
    setApiType(dl.apiType);
    setFormality(dl.formality);
    setIsSaved(Boolean(dl.apiKey));
    setPersistKeyState(isPersistEnabled());

    const az = getAzureSettings();
    setAzureApiKey(az.apiKey);
    setAzureRegion(az.region);
    setAzureEndpoint(az.endpoint);
    setAzurePersistKey(isAzurePersistEnabled());
    setAzureSaved(Boolean(az.apiKey.trim() && az.region.trim()));
  }, []);

  const handleSetDefault = useCallback(
    (provider: TranslationProviderId) => {
      trackEvent('translation_provider_changed', { from: defaultProvider, to: provider });
      setDefaultProvider(provider);
      saveActiveTranslationProvider(provider);
    },
    [defaultProvider],
  );

  const toggleCard = useCallback((provider: TranslationProviderId) => {
    setExpandedCard((prev) => (prev === provider ? null : provider));
  }, []);

  // ── DeepL handlers ──
  const handleTestDeepL = useCallback(async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: t('Please enter an API key') });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      saveDeepLSettings({ apiKey, apiType, formality });
      const usage = await getDeepLClient().getUsage();
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

  const handleSaveDeepL = useCallback(() => {
    saveDeepLSettings({ apiKey, apiType, formality });
    setIsSaved(true);
    setTestResult({ success: true, message: t('Settings saved!') });
  }, [apiKey, apiType, formality, t]);

  const handleClearDeepL = useCallback(() => {
    clearDeepLSettings();
    setApiKey('');
    setApiType('free');
    setFormality('prefer_less');
    setPersistKeyState(false);
    setIsSaved(false);
    setTestResult(null);
  }, []);

  // ── Azure handlers ──
  const handleTestAzure = useCallback(async () => {
    if (!azureApiKey.trim() || !azureRegion.trim()) {
      setAzureTestResult({ success: false, message: t('Please enter an API key and region') });
      return;
    }
    setAzureTesting(true);
    setAzureTestResult(null);
    try {
      saveAzureSettings({ apiKey: azureApiKey, region: azureRegion, endpoint: azureEndpoint });
      await getAzureClient().testKey();
      const sessionUsage = getTranslationUsage('azure');
      setAzureTestResult({
        success: true,
        message: t('API key is valid!'),
        usage:
          sessionUsage.characterCount > 0
            ? { used: sessionUsage.characterCount, limit: 0 }
            : undefined,
      });
      setAzureSaved(true);
    } catch (error) {
      setAzureTestResult({
        success: false,
        message: error instanceof Error ? error.message : t('Failed to connect'),
      });
      setAzureSaved(false);
    } finally {
      setAzureTesting(false);
    }
  }, [azureApiKey, azureEndpoint, azureRegion, t]);

  const handleSaveAzure = useCallback(() => {
    saveAzureSettings({ apiKey: azureApiKey, region: azureRegion, endpoint: azureEndpoint });
    setAzureSaved(true);
    setAzureTestResult((c) => c ?? { success: true, message: t('Settings saved!') });
  }, [azureApiKey, azureEndpoint, azureRegion, t]);

  const handleClearAzure = useCallback(() => {
    clearAzureSettings();
    setAzureApiKey('');
    setAzureRegion('');
    setAzureEndpoint(getDefaultAzureEndpoint());
    setAzurePersistKey(false);
    setAzureSaved(false);
    setAzureTestResult(null);
  }, []);

  // ── Provider card header (reusable) ──
  function ProviderCardHeader({
    provider,
    label,
    configured,
    summary,
  }: {
    provider: TranslationProviderId;
    label: string;
    configured: boolean;
    summary?: string;
  }) {
    const isDefault = defaultProvider === provider;
    const isExpanded = expandedCard === provider;
    return (
      <UnstyledButton onClick={() => toggleCard(provider)} w="100%">
        <Group justify="space-between" p="md">
          <Group gap="sm">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {isDefault && (
              <Tooltip label={t('Default provider')}>
                <Star
                  size={14}
                  fill="var(--mantine-color-yellow-6)"
                  color="var(--mantine-color-yellow-6)"
                />
              </Tooltip>
            )}
            <Text size="sm" fw={600}>
              {label}
            </Text>
            {summary && (
              <Text size="xs" c="dimmed">
                {summary}
              </Text>
            )}
          </Group>
          <Group gap="xs">
            {configured ? (
              <Badge variant="light" color="green" size="sm">
                {t('Configured')}
              </Badge>
            ) : (
              <Badge variant="light" color="gray" size="sm">
                {t('Not configured')}
              </Badge>
            )}
          </Group>
        </Group>
      </UnstyledButton>
    );
  }

  const deeplConfigured = hasProviderCredentials('deepl');
  const azureConfigured = hasProviderCredentials('azure');
  const googleConfigured = hasProviderCredentials('google');
  const anyProviderConfigured = deeplConfigured || azureConfigured || googleConfigured;

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t(
          'These settings apply to the local editor. Cloud projects can override the provider in Project Settings.',
        )}
      </Text>

      <Switch
        label={t('Enable machine translation')}
        description={t(
          'When disabled, all translate buttons and the bulk translation toolbar are hidden.',
        )}
        checked={translateEnabled}
        onChange={(e) => onTranslateEnabledChange?.(e.currentTarget.checked)}
      />

      <Alert color="gray" variant="light" icon={<Shield size={16} />}>
        <Text size="xs">
          {t(
            'Translation text is sent to your selected provider for processing. Data processing regions vary by provider. No translation data is stored by GlossBoss after the response is received.',
          )}{' '}
          <Anchor href="/privacy" target="_blank" size="xs">
            {t('Privacy Policy')}
          </Anchor>
        </Text>
      </Alert>

      <Text size="sm" fw={500}>
        {t('Translation providers')}
      </Text>

      {!anyProviderConfigured && (
        <Alert color="blue" variant="light">
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              {t(
                'Pick any provider below — all offer free tiers, and setup takes about 2 minutes.',
              )}
            </Text>
            <Text size="xs">{t('Recommended for getting started:')}</Text>
            <Stack gap={4}>
              <Group gap="xs">
                <Text size="xs" fw={500}>
                  {t('DeepL Free')}
                </Text>
                <Text size="xs" c="dimmed">
                  {t('— 500,000 characters/month, best general quality')}
                </Text>
                <Anchor
                  href="https://www.deepl.com/pro-api"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                >
                  {t('Get a free API key')}{' '}
                  <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </Anchor>
              </Group>
              <Group gap="xs">
                <Text size="xs" fw={500}>
                  {t('Google Gemini')}
                </Text>
                <Text size="xs" c="dimmed">
                  {t('— generous free tier, best for context-aware translation')}
                </Text>
                <Anchor
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                >
                  {t('Get a free API key')}{' '}
                  <ExternalLink size={10} style={{ display: 'inline', verticalAlign: 'middle' }} />
                </Anchor>
              </Group>
            </Stack>
            <Text size="xs" c="dimmed">
              {t('After you get a key, expand the provider card below and paste it in.')}
            </Text>
          </Stack>
        </Alert>
      )}

      {/* ── DeepL card ── */}
      <Paper withBorder data-tour="settings-provider">
        <ProviderCardHeader
          provider="deepl"
          label={t('DeepL')}
          configured={deeplConfigured}
          summary={
            deeplConfigured
              ? `${maskKey(apiKey)} · ${apiType === 'pro' ? 'Pro' : 'Free'}`
              : undefined
          }
        />
        <Collapse in={expandedCard === 'deepl'}>
          <Divider />
          <Stack gap="sm" p="md">
            {defaultProvider !== 'deepl' && deeplConfigured && (
              <Button
                size="xs"
                variant="light"
                leftSection={<Star size={14} />}
                onClick={() => handleSetDefault('deepl')}
              >
                {t('Set as default')}
              </Button>
            )}

            <Text size="xs" c="dimmed">
              {t('Enter your DeepL API key to enable machine translation. Get a free key at')}{' '}
              <Anchor href="https://www.deepl.com/pro-api" target="_blank" size="xs">
                deepl.com/pro-api <ExternalLink size={10} />
              </Anchor>
            </Text>

            <Switch
              size="sm"
              label={t('Remember API key across sessions')}
              checked={persistKey}
              onChange={(e) => {
                setPersistKeyState(e.currentTarget.checked);
                setPersistEnabled(e.currentTarget.checked);
                setIsSaved(false);
              }}
            />

            <PasswordInput
              data-tour="settings-api-key"
              label={t('API key')}
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

            <Group gap="md">
              <div style={{ flex: 1 }}>
                <Text size="xs" fw={500} mb={4}>
                  {t('Service tier')}
                </Text>
                <SegmentedControl
                  value={apiType}
                  onChange={(v) => {
                    setApiType(v as DeepLApiType);
                    setIsSaved(false);
                  }}
                  data={[
                    { label: t('Free API'), value: 'free' },
                    { label: t('Pro API'), value: 'pro' },
                  ]}
                  fullWidth
                  size="xs"
                />
              </div>
              <div style={{ flex: 1 }}>
                <Text size="xs" fw={500} mb={4}>
                  {t('Formality')}
                </Text>
                <SegmentedControl
                  value={formality}
                  onChange={(v) => {
                    setFormality(v as DeepLFormality);
                    saveDeepLSettings({ formality: v as DeepLFormality });
                  }}
                  data={[
                    { label: t('Informal'), value: 'prefer_less' },
                    { label: t('Formal'), value: 'prefer_more' },
                  ]}
                  fullWidth
                  size="xs"
                />
              </div>
            </Group>

            <Group>
              <Button
                variant="light"
                size="xs"
                onClick={handleTestDeepL}
                loading={isTesting}
                disabled={!apiKey.trim()}
              >
                {t('Test connection')}
              </Button>
              <Button size="xs" onClick={handleSaveDeepL} disabled={!apiKey.trim() || isSaved}>
                {t('Save')}
              </Button>
              {apiKey && (
                <Button variant="subtle" color="red" size="xs" onClick={handleClearDeepL}>
                  {t('Remove')}
                </Button>
              )}
            </Group>

            {testResult && (
              <Alert
                size="sm"
                color={testResult.success ? 'green' : 'red'}
                icon={testResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
              >
                <Stack gap="xs">
                  <Text size="xs">{testResult.message}</Text>
                  {testResult.usage && (
                    <>
                      <Progress
                        value={(testResult.usage.used / testResult.usage.limit) * 100}
                        size="xs"
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
        </Collapse>
      </Paper>

      {/* ── Azure card ── */}
      <Paper withBorder>
        <ProviderCardHeader
          provider="azure"
          label={t('Azure Translator')}
          configured={azureConfigured}
          summary={azureConfigured ? `${maskKey(azureApiKey)} · ${azureRegion}` : undefined}
        />
        <Collapse in={expandedCard === 'azure'}>
          <Divider />
          <Stack gap="sm" p="md">
            {defaultProvider !== 'azure' && azureConfigured && (
              <Button
                size="xs"
                variant="light"
                leftSection={<Star size={14} />}
                onClick={() => handleSetDefault('azure')}
              >
                {t('Set as default')}
              </Button>
            )}

            <Text size="xs" c="dimmed">
              {t('Azure Translator offers 2 million characters/month free.')}{' '}
              <Anchor
                href="https://portal.azure.com/#create/Microsoft.CognitiveServicesTextTranslation"
                target="_blank"
                size="xs"
              >
                {t('Create resource')} <ExternalLink size={10} />
              </Anchor>
            </Text>

            <Switch
              size="sm"
              label={t('Remember API key across sessions')}
              checked={azurePersistKey}
              onChange={(e) => {
                setAzurePersistKey(e.currentTarget.checked);
                setAzurePersistEnabled(e.currentTarget.checked);
                setAzureSaved(false);
              }}
            />

            <PasswordInput
              data-tour="settings-api-key"
              label={t('API key')}
              placeholder={t('Enter your Azure Translator API key')}
              value={azureApiKey}
              onChange={(e) => {
                setAzureApiKey(e.currentTarget.value);
                setAzureSaved(false);
                setAzureTestResult(null);
              }}
              rightSection={
                azureSaved && azureApiKey ? (
                  <Tooltip label={t('Key saved')}>
                    <Check size={16} color="var(--mantine-color-green-6)" />
                  </Tooltip>
                ) : null
              }
            />

            <TextInput
              size="sm"
              label={t('Region')}
              placeholder="westeurope"
              value={azureRegion}
              onChange={(e) => {
                setAzureRegion(e.currentTarget.value);
                setAzureSaved(false);
              }}
            />
            <TextInput
              size="sm"
              label={t('Endpoint')}
              placeholder={getDefaultAzureEndpoint()}
              value={azureEndpoint}
              onChange={(e) => {
                setAzureEndpoint(e.currentTarget.value);
                setAzureSaved(false);
              }}
            />

            <Group>
              <Button
                variant="light"
                size="xs"
                onClick={handleTestAzure}
                loading={azureTesting}
                disabled={!azureApiKey.trim() || !azureRegion.trim()}
              >
                {t('Test connection')}
              </Button>
              <Button
                size="xs"
                onClick={handleSaveAzure}
                disabled={!azureApiKey.trim() || !azureRegion.trim() || azureSaved}
              >
                {t('Save')}
              </Button>
              {azureApiKey && (
                <Button variant="subtle" color="red" size="xs" onClick={handleClearAzure}>
                  {t('Remove')}
                </Button>
              )}
            </Group>

            {azureTestResult && (
              <Alert
                size="sm"
                color={azureTestResult.success ? 'green' : 'red'}
                icon={azureTestResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
              >
                <Stack gap="xs">
                  <Text size="xs">{azureTestResult.message}</Text>
                  {azureTestResult.usage && (
                    <Text size="xs" c="dimmed">
                      {t('Session usage: {{count}} characters', {
                        count: azureTestResult.usage.used.toLocaleString(),
                      })}
                    </Text>
                  )}
                </Stack>
              </Alert>
            )}
          </Stack>
        </Collapse>
      </Paper>

      {/* ── LLM provider cards ── */}
      {LLM_PROVIDERS.map((provider) => (
        <LlmProviderCard
          key={provider.id}
          provider={provider}
          isDefault={defaultProvider === provider.id}
          isExpanded={expandedCard === provider.id}
          onToggle={() => toggleCard(provider.id)}
          onSetDefault={() => handleSetDefault(provider.id)}
        />
      ))}

      {/* ── Custom endpoint card ── */}
      <CustomProviderCard
        isDefault={defaultProvider === 'custom'}
        isExpanded={expandedCard === 'custom'}
        onToggle={() => toggleCard('custom')}
        onSetDefault={() => handleSetDefault('custom')}
      />
    </Stack>
  );
}
