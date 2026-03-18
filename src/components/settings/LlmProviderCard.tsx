/**
 * LlmProviderCard — shared settings card for any LLM translation provider.
 *
 * Renders API key input, model selector, temperature slider, project context
 * toggle, and test/save/clear buttons. Used for all preset LLM providers
 * (OpenAI, Claude, Gemini, Mistral, DeepSeek) in TranslationSection.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Stack,
  PasswordInput,
  Button,
  Group,
  Text,
  Alert,
  Switch,
  Tooltip,
  Anchor,
  Paper,
  Badge,
  Collapse,
  UnstyledButton,
  Divider,
  Select,
  Slider,
} from '@mantine/core';
import { Check, AlertCircle, ExternalLink, Star, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getLlmSettings,
  saveLlmSettings,
  clearLlmSettings,
  isLlmPersistEnabled,
  setLlmPersistEnabled,
  getLlmClient,
  type LlmProviderMeta,
} from '@/lib/llm';
import { getTranslationUsage, type TranslationProviderId } from '@/lib/translation';
import { useTranslation } from '@/lib/app-language';

interface ConnectionResult {
  success: boolean;
  message: string;
  usage?: { used: number; limit: number };
}

function maskKey(key: string): string {
  if (!key || key.length <= 4) return key ? '****' : '';
  return '****' + key.slice(-4);
}

interface LlmProviderCardProps {
  provider: LlmProviderMeta;
  isDefault: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSetDefault: () => void;
}

export function LlmProviderCard({
  provider,
  isDefault,
  isExpanded,
  onToggle,
  onSetDefault,
}: LlmProviderCardProps) {
  const { t } = useTranslation();

  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState(provider.defaultModel);
  const [temperature, setTemperature] = useState(provider.defaultTemperature);
  const [useProjectContext, setUseProjectContext] = useState(false);
  const [persistKey, setPersistKey] = useState(() => isLlmPersistEnabled());
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionResult | null>(null);

  useEffect(() => {
    const settings = getLlmSettings(provider.id);
    setApiKey(settings.apiKey);
    setModelId(settings.modelId);
    setTemperature(settings.temperature);
    setUseProjectContext(settings.useProjectContext);
    setPersistKey(isLlmPersistEnabled());
    setSaved(Boolean(settings.apiKey.trim()));
  }, [provider.id]);

  const handleTest = useCallback(async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: t('Please enter an API key') });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      saveLlmSettings(provider.id, { apiKey, modelId, temperature, useProjectContext });
      await getLlmClient(provider.id).testKey();
      const sessionUsage = getTranslationUsage(provider.id as TranslationProviderId);
      setTestResult({
        success: true,
        message: t('API key is valid!'),
        usage:
          sessionUsage.characterCount > 0
            ? { used: sessionUsage.characterCount, limit: 0 }
            : undefined,
      });
      setSaved(true);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : t('Failed to connect'),
      });
      setSaved(false);
    } finally {
      setTesting(false);
    }
  }, [apiKey, modelId, temperature, useProjectContext, provider.id, t]);

  const handleSave = useCallback(() => {
    saveLlmSettings(provider.id, { apiKey, modelId, temperature, useProjectContext });
    setSaved(true);
    setTestResult((c) => c ?? { success: true, message: t('Settings saved!') });
  }, [apiKey, modelId, temperature, useProjectContext, provider.id, t]);

  const handleClear = useCallback(() => {
    clearLlmSettings(provider.id);
    setApiKey('');
    setModelId(provider.defaultModel);
    setTemperature(provider.defaultTemperature);
    setUseProjectContext(false);
    setPersistKey(false);
    setSaved(false);
    setTestResult(null);
  }, [provider.id, provider.defaultModel, provider.defaultTemperature]);

  const configured = Boolean(apiKey.trim());

  // Model options: presets + current value (if not in presets)
  const modelOptions = provider.models.map((m) => ({ value: m.id, label: m.label }));
  const currentModelInPresets = provider.models.some((m) => m.id === modelId);

  return (
    <Paper withBorder>
      <UnstyledButton onClick={onToggle} w="100%">
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
              {provider.label}
            </Text>
            {configured && (
              <Text size="xs" c="dimmed">
                {maskKey(apiKey)} · {modelId}
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

      <Collapse in={isExpanded}>
        <Divider />
        <Stack gap="sm" p="md">
          {!isDefault && configured && (
            <Button
              size="xs"
              variant="light"
              leftSection={<Star size={14} />}
              onClick={onSetDefault}
            >
              {t('Set as default')}
            </Button>
          )}

          <Text size="xs" c="dimmed">
            {provider.description}{' '}
            <Anchor href={provider.apiKeyUrl} target="_blank" size="xs">
              {t('Get API key')} <ExternalLink size={10} />
            </Anchor>
          </Text>

          <Switch
            size="sm"
            label={t('Remember API key across sessions')}
            checked={persistKey}
            onChange={(e) => {
              setPersistKey(e.currentTarget.checked);
              setLlmPersistEnabled(e.currentTarget.checked);
              setSaved(false);
            }}
          />

          <PasswordInput
            label={t('API key')}
            placeholder={t('Enter your API key')}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.currentTarget.value);
              setSaved(false);
              setTestResult(null);
            }}
            rightSection={
              saved && apiKey ? (
                <Tooltip label={t('Key saved')}>
                  <Check size={16} color="var(--mantine-color-green-6)" />
                </Tooltip>
              ) : null
            }
          />

          <Group gap="md" grow>
            <Select
              size="sm"
              label={t('Model')}
              data={modelOptions}
              value={currentModelInPresets ? modelId : null}
              placeholder={currentModelInPresets ? undefined : modelId || provider.defaultModel}
              onChange={(v) => {
                setModelId(v ?? provider.defaultModel);
                setSaved(false);
              }}
              searchable
              nothingFoundMessage={t('Type a custom model ID')}
            />
            <div>
              <Text size="xs" fw={500} mb={4}>
                {t('Temperature')}
              </Text>
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(v) => {
                  setTemperature(v);
                  setSaved(false);
                }}
                marks={[
                  { value: 0, label: '0' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
                size="sm"
              />
            </div>
          </Group>

          <Switch
            size="sm"
            label={t('Use project context when available')}
            description={t(
              'Use relevant source excerpts for the current project as extra translation context.',
            )}
            checked={useProjectContext}
            onChange={(e) => {
              setUseProjectContext(e.currentTarget.checked);
              setSaved(false);
            }}
          />

          <Group>
            <Button
              variant="light"
              size="xs"
              onClick={handleTest}
              loading={testing}
              disabled={!apiKey.trim()}
            >
              {t('Test connection')}
            </Button>
            <Button size="xs" onClick={handleSave} disabled={!apiKey.trim() || saved}>
              {t('Save')}
            </Button>
            {apiKey && (
              <Button variant="subtle" color="red" size="xs" onClick={handleClear}>
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
                  <Text size="xs" c="dimmed">
                    {t('Session usage: {{count}} characters', {
                      count: testResult.usage.used.toLocaleString(),
                    })}
                  </Text>
                )}
              </Stack>
            </Alert>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}
