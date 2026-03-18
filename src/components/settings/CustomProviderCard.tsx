/**
 * CustomProviderCard — settings card for user-defined OpenAI-compatible endpoints.
 *
 * Lets users add any OpenAI-compatible API (DeepSeek, Groq, Together AI, etc.)
 * by providing a base URL, API key, and model ID.
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
  Switch,
  Tooltip,
  Paper,
  Badge,
  Collapse,
  UnstyledButton,
  Divider,
  Slider,
} from '@mantine/core';
import { Check, AlertCircle, Star, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import {
  getCustomSettings,
  saveCustomSettings,
  clearCustomSettings,
  isLlmPersistEnabled,
  setLlmPersistEnabled,
  getLlmClient,
} from '@/lib/llm';
import { useTranslation } from '@/lib/app-language';

interface ConnectionResult {
  success: boolean;
  message: string;
}

interface CustomProviderCardProps {
  isDefault: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSetDefault: () => void;
}

export function CustomProviderCard({
  isDefault,
  isExpanded,
  onToggle,
  onSetDefault,
}: CustomProviderCardProps) {
  const { t } = useTranslation();

  const [label, setLabel] = useState('');
  const [baseURL, setBaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [useProjectContext, setUseProjectContext] = useState(false);
  const [persistKey, setPersistKey] = useState(() => isLlmPersistEnabled());
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionResult | null>(null);

  useEffect(() => {
    const settings = getCustomSettings();
    setLabel(settings.label);
    setBaseURL(settings.baseURL);
    setApiKey(settings.apiKey);
    setModelId(settings.modelId);
    setTemperature(settings.temperature);
    setUseProjectContext(settings.useProjectContext);
    setPersistKey(isLlmPersistEnabled());
    setSaved(Boolean(settings.baseURL.trim()));
  }, []);

  const handleTest = useCallback(async () => {
    if (!baseURL.trim()) {
      setTestResult({ success: false, message: t('Please enter a base URL') });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      saveCustomSettings({ label, baseURL, apiKey, modelId, temperature, useProjectContext });
      await getLlmClient('custom').testKey();
      setTestResult({ success: true, message: t('API key is valid!') });
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
  }, [label, baseURL, apiKey, modelId, temperature, useProjectContext, t]);

  const handleSave = useCallback(() => {
    saveCustomSettings({ label, baseURL, apiKey, modelId, temperature, useProjectContext });
    setSaved(true);
    setTestResult((c) => c ?? { success: true, message: t('Settings saved!') });
  }, [label, baseURL, apiKey, modelId, temperature, useProjectContext, t]);

  const handleClear = useCallback(() => {
    clearCustomSettings();
    setLabel('');
    setBaseURL('');
    setApiKey('');
    setModelId('');
    setTemperature(0.2);
    setUseProjectContext(false);
    setPersistKey(false);
    setSaved(false);
    setTestResult(null);
  }, []);

  const configured = Boolean(baseURL.trim());

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
            <Globe size={14} />
            <Text size="sm" fw={600}>
              {label || t('Custom endpoint')}
            </Text>
            {configured && (
              <Text size="xs" c="dimmed">
                {baseURL}
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
            {t(
              'Connect any OpenAI-compatible API. Works with providers like Groq, Together AI, and self-hosted models.',
            )}
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

          <TextInput
            size="sm"
            label={t('Display name')}
            placeholder={t('e.g. My Groq API')}
            value={label}
            onChange={(e) => {
              setLabel(e.currentTarget.value);
              setSaved(false);
            }}
          />

          <TextInput
            size="sm"
            label={t('Base URL')}
            placeholder="https://api.example.com/v1"
            description={t('The OpenAI-compatible API base URL. Must use HTTPS.')}
            value={baseURL}
            onChange={(e) => {
              setBaseURL(e.currentTarget.value);
              setSaved(false);
              setTestResult(null);
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
            <TextInput
              size="sm"
              label={t('Model')}
              placeholder="gpt-4o-mini"
              value={modelId}
              onChange={(e) => {
                setModelId(e.currentTarget.value);
                setSaved(false);
              }}
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
              disabled={!baseURL.trim()}
            >
              {t('Test connection')}
            </Button>
            <Button size="xs" onClick={handleSave} disabled={!baseURL.trim() || saved}>
              {t('Save')}
            </Button>
            {baseURL && (
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
              <Text size="xs">{testResult.message}</Text>
            </Alert>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}
