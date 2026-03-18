/**
 * OrgTranslationTab — org-level default translation provider and glossary settings.
 *
 * Org admins set defaults that cascade to all projects in the org.
 * Each setting can be a "default" (projects can override) or "enforced" (locked).
 */

import { useState, useCallback, useEffect } from 'react';
import { Stack, Paper, Text, Select, Switch, Button, Group, Alert, Textarea } from '@mantine/core';
import { Check, AlertCircle, Lock } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { getOrgSettings, upsertOrgSettings } from '@/lib/organizations/api';
import type { OrgSettingsRow } from '@/lib/organizations/types';
import {
  ALL_TRANSLATION_PROVIDERS,
  getTranslationProviderLabel,
  hasProviderCredentials,
} from '@/lib/translation';
import type { TranslationProviderId } from '@/lib/translation/types';

interface OrgTranslationTabProps {
  orgId: string;
  isAdmin: boolean;
}

export function OrgTranslationTab({ orgId, isAdmin }: OrgTranslationTabProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<OrgSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Editable state
  const [defaultProvider, setDefaultProvider] = useState<string>('');
  const [enforceProvider, setEnforceProvider] = useState(false);
  const [defaultGlossaryEnforcement, setDefaultGlossaryEnforcement] = useState(true);
  const [enforceGlossaryEnforcement, setEnforceGlossaryEnforcement] = useState(false);
  const [translationInstructions, setTranslationInstructions] = useState('');

  useEffect(() => {
    let cancelled = false;
    getOrgSettings(orgId)
      .then((s) => {
        if (cancelled) return;
        setSettings(s);
        if (s) {
          setDefaultProvider(s.default_translation_provider ?? '');
          setEnforceProvider(s.enforce_translation_provider);
          setDefaultGlossaryEnforcement(s.default_glossary_enforcement);
          setEnforceGlossaryEnforcement(s.enforce_glossary_enforcement);
          setTranslationInstructions(s.translation_instructions ?? '');
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const isDirty =
    defaultProvider !== (settings?.default_translation_provider ?? '') ||
    enforceProvider !== (settings?.enforce_translation_provider ?? false) ||
    defaultGlossaryEnforcement !== (settings?.default_glossary_enforcement ?? true) ||
    enforceGlossaryEnforcement !== (settings?.enforce_glossary_enforcement ?? false) ||
    translationInstructions !== (settings?.translation_instructions ?? '');

  const handleSave = useCallback(async () => {
    setSaving(true);
    setResult(null);
    try {
      const updated = await upsertOrgSettings(orgId, {
        default_translation_provider: (defaultProvider as TranslationProviderId) || null,
        enforce_translation_provider: enforceProvider,
        default_glossary_enforcement: defaultGlossaryEnforcement,
        enforce_glossary_enforcement: enforceGlossaryEnforcement,
        translation_instructions: translationInstructions,
      });
      setSettings(updated);
      setResult({ ok: true, msg: t('Organization translation settings saved.') });
    } catch (err) {
      setResult({
        ok: false,
        msg: err instanceof Error ? err.message : t('Failed to save settings.'),
      });
    } finally {
      setSaving(false);
    }
  }, [
    orgId,
    defaultProvider,
    enforceProvider,
    defaultGlossaryEnforcement,
    enforceGlossaryEnforcement,
    translationInstructions,
    t,
  ]);

  if (loading) {
    return (
      <Text size="sm" c="dimmed">
        {t('Loading...')}
      </Text>
    );
  }

  const providerOptions = [
    { value: '', label: t('None (projects choose their own)') },
    ...ALL_TRANSLATION_PROVIDERS.filter((p) => hasProviderCredentials(p)).map((p) => ({
      value: p,
      label: getTranslationProviderLabel(p),
    })),
  ];

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t(
          'Set default translation settings for all projects in this organization. Projects can override these unless they are enforced.',
        )}
      </Text>

      {isAdmin ? (
        <>
          <Paper withBorder p="md">
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                {t('Translation provider')}
              </Text>

              <Select
                label={t('Default provider')}
                description={t('Projects in this org will use this provider by default.')}
                data={providerOptions}
                value={defaultProvider}
                onChange={(v) => setDefaultProvider(v ?? '')}
                size="sm"
              />

              <Switch
                label={
                  <Group gap={4}>
                    <Lock size={12} />
                    {t('Enforce for all projects')}
                  </Group>
                }
                description={t(
                  'When enforced, projects cannot override this setting. All translations will use the org provider.',
                )}
                checked={enforceProvider}
                onChange={(e) => setEnforceProvider(e.currentTarget.checked)}
                disabled={!defaultProvider}
                size="sm"
              />
            </Stack>
          </Paper>

          <Paper withBorder p="md">
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                {t('Glossary')}
              </Text>

              <Switch
                label={t('Default glossary enforcement')}
                description={t(
                  'Whether glossary terms are enforced in machine translations by default.',
                )}
                checked={defaultGlossaryEnforcement}
                onChange={(e) => setDefaultGlossaryEnforcement(e.currentTarget.checked)}
                size="sm"
              />

              <Switch
                label={
                  <Group gap={4}>
                    <Lock size={12} />
                    {t('Enforce for all projects')}
                  </Group>
                }
                description={t('When enforced, projects cannot disable glossary enforcement.')}
                checked={enforceGlossaryEnforcement}
                onChange={(e) => setEnforceGlossaryEnforcement(e.currentTarget.checked)}
                size="sm"
              />
            </Stack>
          </Paper>

          <Paper withBorder p="md">
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                {t('Translation instructions')}
              </Text>

              <Textarea
                label={t('Custom instructions for AI translation')}
                description={t(
                  'These instructions are included in every AI translation prompt for all projects in this org. Use them for tone, style, or terminology guidance.',
                )}
                placeholder={t(
                  'e.g. Always use formal register. Prefer British English spellings.',
                )}
                value={translationInstructions}
                onChange={(e) => setTranslationInstructions(e.currentTarget.value)}
                autosize
                minRows={2}
                maxRows={6}
                maxLength={2000}
                size="sm"
              />
            </Stack>
          </Paper>

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
            <Button onClick={handleSave} loading={saving} disabled={!isDirty}>
              {t('Save')}
            </Button>
          </Group>
        </>
      ) : (
        <Paper withBorder p="md">
          <Stack gap="xs">
            <Text size="sm">
              <strong>{t('Default provider')}:</strong>{' '}
              {settings?.default_translation_provider
                ? getTranslationProviderLabel(settings.default_translation_provider)
                : t('None')}
              {settings?.enforce_translation_provider && (
                <Text component="span" size="xs" c="dimmed" ml={4}>
                  ({t('Enforced')})
                </Text>
              )}
            </Text>
            <Text size="sm">
              <strong>{t('Glossary enforcement')}:</strong>{' '}
              {settings?.default_glossary_enforcement ? t('Enabled') : t('Disabled')}
              {settings?.enforce_glossary_enforcement && (
                <Text component="span" size="xs" c="dimmed" ml={4}>
                  ({t('Enforced')})
                </Text>
              )}
            </Text>
            {settings?.translation_instructions && (
              <Text size="sm">
                <strong>{t('Translation instructions')}:</strong>{' '}
                {settings.translation_instructions}
              </Text>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
