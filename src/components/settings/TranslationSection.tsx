/**
 * Translation Section — provider selector, API key inputs, test connection,
 * formality/model settings, persist toggles, and usage display.
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
  Select,
  Switch,
  Tooltip,
  Anchor,
} from '@mantine/core';
import { Check, AlertCircle, ExternalLink, Languages } from 'lucide-react';
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
  clearGeminiSettings,
  getDefaultGeminiModel,
  getGeminiClient,
  getGeminiSettings,
  isGeminiPersistEnabled,
  saveGeminiSettings,
  setGeminiPersistEnabled,
} from '@/lib/gemini';
import {
  getTranslationProviderSettings,
  getTranslationProviderLabel,
  getTranslationUsage,
  saveActiveTranslationProvider,
  type TranslationProviderId,
} from '@/lib/translation';
import { useTranslation } from '@/lib/app-language';

interface TranslationConnectionResult {
  success: boolean;
  message: string;
  usage?: { used: number; limit: number };
}

export interface TranslationSectionProps {
  translateEnabled?: boolean;
  onTranslateEnabledChange?: (enabled: boolean) => void;
}

export function TranslationSection({
  translateEnabled = true,
  onTranslateEnabledChange,
}: TranslationSectionProps) {
  const { t } = useTranslation();

  // Provider state
  const [translationProvider, setTranslationProvider] = useState<TranslationProviderId>('deepl');

  // DeepL state
  const [apiKey, setApiKey] = useState('');
  const [apiType, setApiType] = useState<DeepLApiType>('free');
  const [formality, setFormality] = useState<DeepLFormality>('prefer_less');
  const [persistKey, setPersistKey] = useState(() => isPersistEnabled());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TranslationConnectionResult | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Azure state
  const [azureApiKey, setAzureApiKey] = useState('');
  const [azureRegion, setAzureRegion] = useState('');
  const [azureEndpoint, setAzureEndpoint] = useState(getDefaultAzureEndpoint());
  const [azurePersistKey, setAzurePersistKey] = useState(() => isAzurePersistEnabled());
  const [azureTesting, setAzureTesting] = useState(false);
  const [azureSaved, setAzureSaved] = useState(false);
  const [azureTestResult, setAzureTestResult] = useState<TranslationConnectionResult | null>(null);

  // Gemini state
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [geminiModelId, setGeminiModelId] = useState(getDefaultGeminiModel());
  const [geminiUseProjectContext, setGeminiUseProjectContext] = useState(false);
  const [geminiPersistKey, setGeminiPersistKey] = useState(() => isGeminiPersistEnabled());
  const [geminiTesting, setGeminiTesting] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<TranslationConnectionResult | null>(
    null,
  );

  // Load saved settings on mount
  useEffect(() => {
    setTranslationProvider(getTranslationProviderSettings().provider);

    const settings = getDeepLSettings();
    setApiKey(settings.apiKey);
    setApiType(settings.apiType);
    setFormality(settings.formality);
    setIsSaved(Boolean(settings.apiKey));
    setPersistKey(isPersistEnabled());
    setTestResult(null);

    const azureSettings = getAzureSettings();
    setAzureApiKey(azureSettings.apiKey);
    setAzureRegion(azureSettings.region);
    setAzureEndpoint(azureSettings.endpoint);
    setAzurePersistKey(isAzurePersistEnabled());
    setAzureSaved(Boolean(azureSettings.apiKey.trim() && azureSettings.region.trim()));
    setAzureTestResult(null);

    const geminiSettings = getGeminiSettings();
    setGeminiApiKey(geminiSettings.apiKey);
    setGeminiModelId(geminiSettings.modelId);
    setGeminiUseProjectContext(geminiSettings.useProjectContext);
    setGeminiPersistKey(isGeminiPersistEnabled());
    setGeminiSaved(Boolean(geminiSettings.apiKey.trim()));
    setGeminiTestResult(null);
  }, []);

  // DeepL handlers
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

  const handleTranslationProviderChange = useCallback((provider: TranslationProviderId) => {
    setTranslationProvider(provider);
    saveActiveTranslationProvider(provider);
  }, []);

  // Azure handlers
  const handleTestAzureKey = useCallback(async () => {
    if (!azureApiKey.trim() || !azureRegion.trim()) {
      setAzureTestResult({
        success: false,
        message: t('Please enter an API key and region'),
      });
      return;
    }

    setAzureTesting(true);
    setAzureTestResult(null);

    try {
      saveAzureSettings({
        apiKey: azureApiKey,
        region: azureRegion,
        endpoint: azureEndpoint,
      });
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

  const handleSaveAzureSettings = useCallback(() => {
    saveAzureSettings({
      apiKey: azureApiKey,
      region: azureRegion,
      endpoint: azureEndpoint,
    });
    setAzureSaved(true);
    setAzureTestResult((current) => current ?? { success: true, message: t('Settings saved!') });
  }, [azureApiKey, azureEndpoint, azureRegion, t]);

  const handleClearAzureKey = useCallback(() => {
    clearAzureSettings();
    setAzureApiKey('');
    setAzureRegion('');
    setAzureEndpoint(getDefaultAzureEndpoint());
    setAzurePersistKey(false);
    setAzureSaved(false);
    setAzureTestResult(null);
  }, []);

  // Gemini handlers
  const handleTestGeminiKey = useCallback(async () => {
    if (!geminiApiKey.trim()) {
      setGeminiTestResult({
        success: false,
        message: t('Please enter an API key'),
      });
      return;
    }

    setGeminiTesting(true);
    setGeminiTestResult(null);

    try {
      saveGeminiSettings({
        apiKey: geminiApiKey,
        modelId: geminiModelId,
        useProjectContext: geminiUseProjectContext,
      });
      await getGeminiClient().testKey();
      const sessionUsage = getTranslationUsage('gemini');
      setGeminiTestResult({
        success: true,
        message: t('API key is valid!'),
        usage:
          sessionUsage.characterCount > 0
            ? { used: sessionUsage.characterCount, limit: 0 }
            : undefined,
      });
      setGeminiSaved(true);
    } catch (error) {
      setGeminiTestResult({
        success: false,
        message: error instanceof Error ? error.message : t('Failed to connect'),
      });
      setGeminiSaved(false);
    } finally {
      setGeminiTesting(false);
    }
  }, [geminiApiKey, geminiModelId, geminiUseProjectContext, t]);

  const handleSaveGeminiSettings = useCallback(() => {
    saveGeminiSettings({
      apiKey: geminiApiKey,
      modelId: geminiModelId,
      useProjectContext: geminiUseProjectContext,
    });
    setGeminiSaved(true);
    setGeminiTestResult((current) => current ?? { success: true, message: t('Settings saved!') });
  }, [geminiApiKey, geminiModelId, geminiUseProjectContext, t]);

  const handleClearGeminiKey = useCallback(() => {
    clearGeminiSettings();
    setGeminiApiKey('');
    setGeminiModelId(getDefaultGeminiModel());
    setGeminiUseProjectContext(false);
    setGeminiPersistKey(false);
    setGeminiSaved(false);
    setGeminiTestResult(null);
  }, []);

  return (
    <Stack gap="md">
      <Switch
        label={t('Enable machine translation')}
        description={t(
          'When disabled, all translate buttons and the bulk translation toolbar are hidden.',
        )}
        checked={translateEnabled}
        onChange={(e) => onTranslateEnabledChange?.(e.currentTarget.checked)}
      />

      <Select
        label={t('Translation provider')}
        value={translationProvider}
        onChange={(value) => {
          if (value === 'deepl' || value === 'azure' || value === 'gemini') {
            handleTranslationProviderChange(value);
          }
        }}
        data={[
          { value: 'deepl', label: 'DeepL' },
          { value: 'azure', label: 'Azure Translator' },
          { value: 'gemini', label: 'Gemini' },
        ]}
      />

      <Alert color="blue" icon={<Languages size={16} />}>
        <Text size="sm">
          {t('Selected provider: {{provider}}', {
            provider: getTranslationProviderLabel(translationProvider),
          })}
        </Text>
      </Alert>

      {translationProvider === 'deepl' && (
        <>
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

          <div data-ev-id="ev_a06444cf83">
            <Text size="sm" fw={500} mb={4}>
              {t('API type')}
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
              {t('Controls the tone of DeepL translations. Not all languages support formality.')}
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
                      color={testResult.usage.used / testResult.usage.limit > 0.9 ? 'red' : 'blue'}
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
        </>
      )}

      {translationProvider === 'azure' && (
        <>
          <Text size="sm" c="dimmed">
            {t(
              'Azure Translator offers 2 million characters/month free. Create a Translator resource in the Azure portal to get your API key and region.',
            )}{' '}
            <Anchor
              href="https://portal.azure.com/#create/Microsoft.CognitiveServicesTextTranslation"
              target="_blank"
              size="sm"
              style={{
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {t('Create resource')}
              <ExternalLink size={12} />
            </Anchor>
            {' · '}
            <Anchor
              href="https://learn.microsoft.com/en-us/azure/ai-services/translator/quickstart-text-rest-api"
              target="_blank"
              size="sm"
              style={{
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {t('Quickstart guide')}
              <ExternalLink size={12} />
            </Anchor>
          </Text>

          <Alert color="yellow" icon={<AlertCircle size={16} />}>
            <Text size="sm">
              {t(
                'Azure credentials are kept in this browser tab by default. Enable "Remember API key" only on a personal, trusted device.',
              )}
            </Text>
          </Alert>

          <Switch
            label={t('Remember API key across sessions')}
            description={t(
              'When enabled, your Azure key is stored in localStorage and survives browser restarts.',
            )}
            checked={azurePersistKey}
            onChange={(e) => {
              const enabled = e.currentTarget.checked;
              setAzurePersistKey(enabled);
              setAzurePersistEnabled(enabled);
              setAzureSaved(false);
            }}
          />

          <PasswordInput
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
            label={t('Region')}
            placeholder={t('e.g. westeurope')}
            value={azureRegion}
            onChange={(e) => {
              setAzureRegion(e.currentTarget.value);
              setAzureSaved(false);
              setAzureTestResult(null);
            }}
          />

          <TextInput
            label={t('Endpoint')}
            placeholder={getDefaultAzureEndpoint()}
            value={azureEndpoint}
            onChange={(e) => {
              setAzureEndpoint(e.currentTarget.value);
              setAzureSaved(false);
              setAzureTestResult(null);
            }}
          />

          <Group>
            <Button
              variant="light"
              onClick={handleTestAzureKey}
              loading={azureTesting}
              disabled={!azureApiKey.trim() || !azureRegion.trim()}
            >
              {t('Test Connection')}
            </Button>
            <Button
              onClick={handleSaveAzureSettings}
              disabled={!azureApiKey.trim() || !azureRegion.trim() || azureSaved}
            >
              {t('Save')}
            </Button>
            {azureApiKey && (
              <Button variant="subtle" color="red" onClick={handleClearAzureKey}>
                {t('Remove saved key')}
              </Button>
            )}
          </Group>

          {azureTestResult && (
            <Alert
              color={azureTestResult.success ? 'green' : 'red'}
              icon={azureTestResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
            >
              <Stack gap="xs">
                <Text size="sm">{azureTestResult.message}</Text>
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
        </>
      )}

      {translationProvider === 'gemini' && (
        <>
          <Text size="sm" c="dimmed">
            {t(
              'Gemini translates with AI and can optionally use project source context from the current WordPress slug when available. Get a free API key from Google AI Studio.',
            )}{' '}
            <Anchor
              href="https://aistudio.google.com/apikey"
              target="_blank"
              size="sm"
              style={{
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {t('Get API key')}
              <ExternalLink size={12} />
            </Anchor>
            {' · '}
            <Anchor
              href="https://ai.google.dev/gemini-api/docs/quickstart"
              target="_blank"
              size="sm"
              style={{
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {t('Quickstart guide')}
              <ExternalLink size={12} />
            </Anchor>
          </Text>

          <Alert color="yellow" icon={<AlertCircle size={16} />}>
            <Text size="sm">
              {t(
                'Gemini credentials are kept in this browser tab by default. Enable "Remember API key" only on a personal, trusted device.',
              )}
            </Text>
          </Alert>

          <Switch
            label={t('Remember API key across sessions')}
            description={t(
              'When enabled, your Gemini key is stored in localStorage and survives browser restarts.',
            )}
            checked={geminiPersistKey}
            onChange={(e) => {
              const enabled = e.currentTarget.checked;
              setGeminiPersistKey(enabled);
              setGeminiPersistEnabled(enabled);
              setGeminiSaved(false);
            }}
          />

          <PasswordInput
            label={t('API key')}
            placeholder={t('Enter your Gemini API key')}
            value={geminiApiKey}
            onChange={(e) => {
              setGeminiApiKey(e.currentTarget.value);
              setGeminiSaved(false);
              setGeminiTestResult(null);
            }}
            rightSection={
              geminiSaved && geminiApiKey ? (
                <Tooltip label={t('Key saved')}>
                  <Check size={16} color="var(--mantine-color-green-6)" />
                </Tooltip>
              ) : null
            }
          />

          <TextInput
            label={t('Model')}
            placeholder={getDefaultGeminiModel()}
            value={geminiModelId}
            onChange={(e) => {
              setGeminiModelId(e.currentTarget.value);
              setGeminiSaved(false);
              setGeminiTestResult(null);
            }}
          />

          <Switch
            label={t('Use project slug context when available')}
            description={t(
              'When enabled, Gemini can use relevant WordPress plugin source excerpts for the current project slug as extra translation context.',
            )}
            checked={geminiUseProjectContext}
            onChange={(e) => {
              setGeminiUseProjectContext(e.currentTarget.checked);
              setGeminiSaved(false);
            }}
          />

          <Group>
            <Button
              variant="light"
              onClick={handleTestGeminiKey}
              loading={geminiTesting}
              disabled={!geminiApiKey.trim()}
            >
              {t('Test Connection')}
            </Button>
            <Button
              onClick={handleSaveGeminiSettings}
              disabled={!geminiApiKey.trim() || geminiSaved}
            >
              {t('Save')}
            </Button>
            {geminiApiKey && (
              <Button variant="subtle" color="red" onClick={handleClearGeminiKey}>
                {t('Remove saved key')}
              </Button>
            )}
          </Group>

          {geminiTestResult && (
            <Alert
              color={geminiTestResult.success ? 'green' : 'red'}
              icon={geminiTestResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
            >
              <Stack gap="xs">
                <Text size="sm">{geminiTestResult.message}</Text>
                {geminiTestResult.usage && (
                  <Text size="xs" c="dimmed">
                    {t('Session usage: {{count}} characters', {
                      count: geminiTestResult.usage.used.toLocaleString(),
                    })}
                  </Text>
                )}
              </Stack>
            </Alert>
          )}
        </>
      )}
    </Stack>
  );
}
