/**
 * ProjectTranslationTab — per-language translation provider override with
 * org inheritance indicators and shared credential selection.
 */

import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router';
import {
  Anchor,
  Stack,
  Paper,
  Group,
  Text,
  Select,
  Button,
  Alert,
  Badge,
  Radio,
  Divider,
  Textarea,
} from '@mantine/core';
import { Key, AlertCircle, Check } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { updateProjectLanguage } from '@/lib/projects/api';
import type { ProjectLanguageRow } from '@/lib/projects/types';
import type { TranslationProviderId } from '@/lib/translation/types';
import {
  ALL_TRANSLATION_PROVIDERS,
  getTranslationProviderLabel,
  hasProviderCredentials,
} from '@/lib/translation';
import { getActiveTranslationProvider } from '@/lib/translation/settings';
import type { OrgSettingsRow } from '@/lib/organizations/types';
import type { SharedCredentialRow } from '@/lib/shared-credentials/types';
import { listAvailableCredentials } from '@/lib/shared-credentials/api';
import { SettingsSourceBadge, type SettingsSource } from '@/components/ui';
import { SharedCredentialsTab } from '@/components/organizations/SharedCredentialsTab';

function maskKey(key: string): string {
  if (!key || key.length <= 4) return key ? '****' : '';
  return '****' + key.slice(-4);
}

interface LanguageTranslationCardProps {
  language: ProjectLanguageRow;
  projectId: string;
  orgId: string | null;
  orgSettings: OrgSettingsRow | null;
  isManager: boolean;
  onUpdated: (updated: ProjectLanguageRow) => void;
}

function LanguageTranslationCard({
  language,
  projectId,
  orgId,
  orgSettings,
  isManager,
  onUpdated,
}: LanguageTranslationCardProps) {
  const { t } = useTranslation();
  const globalDefault = getActiveTranslationProvider();
  const globalLabel = getTranslationProviderLabel(globalDefault);

  const orgEnforced = orgSettings?.enforce_translation_provider ?? false;
  const orgDefaultProvider = orgSettings?.default_translation_provider ?? null;

  const [provider, setProvider] = useState<string>(language.translation_provider ?? '');
  const [instructions, setInstructions] = useState(language.translation_instructions ?? '');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Shared credentials
  const [sharedCreds, setSharedCreds] = useState<SharedCredentialRow[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<string>('personal');

  useEffect(() => {
    listAvailableCredentials(projectId, orgId)
      .then(setSharedCreds)
      .catch(() => {});
  }, [projectId, orgId]);

  // Load saved credential choice from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`glossboss-credential-choice-${language.id}`);
      if (stored) setSelectedCredential(stored);
    } catch {
      // ignore
    }
  }, [language.id]);

  const isDirty =
    provider !== (language.translation_provider ?? '') ||
    instructions !== (language.translation_instructions ?? '');

  // Determine source badge
  let providerSource: SettingsSource = 'personal';
  if (orgEnforced && orgDefaultProvider) {
    providerSource = 'org-enforced';
  } else if (language.translation_provider) {
    providerSource = 'project';
  } else if (orgDefaultProvider) {
    providerSource = 'org-default';
  }

  const effectiveProviderLabel =
    orgEnforced && orgDefaultProvider
      ? getTranslationProviderLabel(orgDefaultProvider)
      : language.translation_provider
        ? getTranslationProviderLabel(language.translation_provider)
        : orgDefaultProvider
          ? t('Org default ({{provider}})', {
              provider: getTranslationProviderLabel(orgDefaultProvider),
            })
          : t('Global default ({{provider}})', { provider: globalLabel });

  const options = [
    {
      value: '',
      label: orgDefaultProvider
        ? t('Org default ({{provider}})', {
            provider: getTranslationProviderLabel(orgDefaultProvider),
          })
        : t('Global default ({{provider}})', { provider: globalLabel }),
    },
    ...ALL_TRANSLATION_PROVIDERS.filter((p) => hasProviderCredentials(p)).map((p) => ({
      value: p,
      label: getTranslationProviderLabel(p),
    })),
  ];

  const handleSave = useCallback(async () => {
    setSaving(true);
    setResult(null);
    try {
      const translationProvider = provider || null;
      const updated = await updateProjectLanguage(language.id, {
        translation_provider: translationProvider as TranslationProviderId | null,
        translation_instructions: instructions,
      });
      onUpdated(updated);
      // Save credential choice
      localStorage.setItem(`glossboss-credential-choice-${language.id}`, selectedCredential);
      setResult({ ok: true, msg: t('Translation provider saved.') });
    } catch (err) {
      setResult({
        ok: false,
        msg: err instanceof Error ? err.message : t('Failed to save translation provider.'),
      });
    } finally {
      setSaving(false);
    }
  }, [language.id, provider, instructions, selectedCredential, onUpdated, t]);

  return (
    <Paper withBorder p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <Text size="sm" fw={600}>
              {language.locale}
            </Text>
            {language.source_filename && (
              <Text size="xs" c="dimmed" truncate>
                {language.source_filename}
              </Text>
            )}
          </Group>
          <Group gap="xs">
            <Badge variant="light" size="sm">
              {effectiveProviderLabel}
            </Badge>
            <SettingsSourceBadge source={providerSource} />
          </Group>
        </Group>

        {isManager && !orgEnforced ? (
          <>
            <Select
              size="xs"
              label={t('Translation provider')}
              data={options}
              value={provider}
              onChange={(v) => setProvider(v ?? '')}
              description={t(
                'Override the default provider for this language. Only configured providers are shown.',
              )}
            />

            {/* Shared credential selection */}
            {sharedCreds.length > 0 && (
              <>
                <Divider label={t('Credentials')} labelPosition="left" />
                <Radio.Group
                  value={selectedCredential}
                  onChange={setSelectedCredential}
                  label={t('API key to use')}
                  size="xs"
                >
                  <Stack gap="xs" mt="xs">
                    <Radio value="personal" label={t('Personal key')} />
                    {sharedCreds.map((cred) => {
                      const apiKey = (cred.config as { apiKey?: string }).apiKey ?? '';
                      const scope = cred.organization_id ? t('Org') : t('Project');
                      return (
                        <Radio
                          key={cred.id}
                          value={cred.id}
                          label={`${scope}: ${cred.label} (${maskKey(apiKey)})`}
                        />
                      );
                    })}
                  </Stack>
                </Radio.Group>
              </>
            )}

            <Textarea
              size="xs"
              label={t('Translation instructions')}
              description={
                orgSettings?.translation_instructions
                  ? t('These instructions are combined with org-level instructions.')
                  : t(
                      'Custom instructions for AI translation of this language. Included in every LLM translation prompt.',
                    )
              }
              placeholder={t(
                'e.g. Use casual tone for this gaming app. Prefer du over Sie in German.',
              )}
              value={instructions}
              onChange={(e) => setInstructions(e.currentTarget.value)}
              autosize
              minRows={2}
              maxRows={4}
              maxLength={2000}
            />

            {result && (
              <Alert
                color={result.ok ? 'green' : 'red'}
                variant="light"
                icon={result.ok ? <Check size={14} /> : <AlertCircle size={14} />}
              >
                <Text size="xs">{result.msg}</Text>
              </Alert>
            )}

            <Group>
              <Button
                size="xs"
                onClick={handleSave}
                loading={saving}
                disabled={!isDirty && selectedCredential === 'personal'}
              >
                {t('Save')}
              </Button>
            </Group>
          </>
        ) : orgEnforced ? (
          <Text size="xs" c="dimmed">
            {t(
              'The translation provider is enforced by your organization and cannot be changed at the project level.',
            )}
          </Text>
        ) : (
          <Text size="xs" c="dimmed">
            {t('Provider: {{provider}}', { provider: effectiveProviderLabel })}
          </Text>
        )}
      </Stack>
    </Paper>
  );
}

interface ProjectTranslationTabProps {
  languages: ProjectLanguageRow[];
  projectId: string;
  orgId: string | null;
  orgSettings: OrgSettingsRow | null;
  isManager: boolean;
  onLanguageUpdated: (updated: ProjectLanguageRow) => void;
}

export function ProjectTranslationTab({
  languages,
  projectId,
  orgId,
  orgSettings,
  isManager,
  onLanguageUpdated,
}: ProjectTranslationTabProps) {
  const { t } = useTranslation();

  if (languages.length === 0) {
    return (
      <Alert color="blue" variant="light" icon={<Key size={16} />}>
        <Text size="sm">{t('Add a language to configure translation providers.')}</Text>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t('Override the translation provider per language. Configure API keys in')}{' '}
        <Anchor component={Link} to="/settings?tab=translation" size="sm">
          {t('Settings → Translation')}
        </Anchor>
        .
      </Text>
      {languages.map((lang) => (
        <LanguageTranslationCard
          key={lang.id}
          language={lang}
          projectId={projectId}
          orgId={orgId}
          orgSettings={orgSettings}
          isManager={isManager}
          onUpdated={onLanguageUpdated}
        />
      ))}

      {/* Project-scoped shared credentials */}
      {isManager && (
        <>
          <Divider label={t('Project shared credentials')} labelPosition="center" />
          <SharedCredentialsTab projectId={projectId} canManage={isManager} />
        </>
      )}
    </Stack>
  );
}
