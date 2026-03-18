/**
 * ProjectNotificationsTab — per-project notification overrides.
 *
 * List with three-state toggle buttons per channel: inherit / on / off.
 * Clicking cycles through the states. Digest frequency override below.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Stack,
  Paper,
  Text,
  ActionIcon,
  Group,
  Select,
  Loader,
  Alert,
  Tooltip,
  Table,
} from '@mantine/core';
import { AlertCircle, MessageCircle, Mail, BellRing, Minus } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { msgid } from '@/lib/app-language';
import {
  getProjectNotificationPreferences,
  upsertProjectNotificationPreferences,
} from '@/lib/notifications/preferences-api';
import type {
  NotificationType,
  NotificationChannelPrefs,
  NotificationChannel,
  DigestFrequency,
} from '@/lib/notifications/types';

const TYPE_LABELS: Record<NotificationType, string> = {
  org_invite_received: msgid('Organization invite received'),
  org_invite_accepted: msgid('Organization invite accepted'),
  project_invite_received: msgid('Project invite received'),
  project_invite_accepted: msgid('Project invite accepted'),
  project_member_added: msgid('Added to a project'),
  org_member_added: msgid('Added to an organization'),
  review_status_changed: msgid('Review status changed'),
  review_comment_added: msgid('Review comment added'),
  strings_updated: msgid('Strings updated (digest)'),
};

const PROJECT_TYPES: NotificationType[] = [
  'project_invite_received',
  'project_invite_accepted',
  'project_member_added',
  'review_status_changed',
  'review_comment_added',
  'strings_updated',
];

const CHANNEL_META: Record<NotificationChannel, { icon: typeof Bell; label: string }> = {
  in_app: { icon: MessageCircle, label: msgid('In-app') },
  email: { icon: Mail, label: msgid('Email') },
  push: { icon: BellRing, label: msgid('Push') },
};

const CHANNELS: NotificationChannel[] = ['in_app', 'email', 'push'];

const DIGEST_OPTIONS = [
  { value: 'inherit', label: msgid('Inherit from global') },
  { value: 'hourly', label: msgid('Hourly') },
  { value: 'daily', label: msgid('Daily') },
  { value: 'weekly', label: msgid('Weekly') },
  { value: 'off', label: msgid('Off') },
];

/** Three-state: undefined (inherit) → true (on) → false (off) → undefined */
type ThreeState = boolean | undefined;

function nextThreeState(current: ThreeState): ThreeState {
  if (current === undefined) return true;
  if (current === true) return false;
  return undefined;
}

function threeStateLabel(current: ThreeState): string {
  if (current === undefined) return 'Inherit';
  return current ? 'On' : 'Off';
}

interface ProjectNotificationsTabProps {
  projectId: string;
}

export function ProjectNotificationsTab({ projectId }: ProjectNotificationsTabProps) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<Partial<Record<NotificationType, NotificationChannelPrefs>>>(
    {},
  );
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProjectNotificationPreferences(projectId)
      .then((row) => {
        if (cancelled) return;
        if (row) {
          setPrefs(row.preferences);
          setDigestFrequency(row.digest_frequency);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('Failed to load preferences'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, t]);

  const save = useCallback(
    (
      newPrefs: Partial<Record<NotificationType, NotificationChannelPrefs>>,
      newDigest: DigestFrequency | null,
    ) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        upsertProjectNotificationPreferences(projectId, newPrefs, newDigest).catch((err) => {
          console.error('Failed to save project notification preferences:', err);
        });
      }, 600);
    },
    [projectId],
  );

  const getThreeState = (type: NotificationType, channel: NotificationChannel): ThreeState => {
    const val = prefs[type]?.[channel];
    if (val === undefined || val === null) return undefined;
    return val;
  };

  const cycleThreeState = useCallback(
    (type: NotificationType, channel: NotificationChannel) => {
      setPrefs((prev) => {
        const current = prev[type]?.[channel];
        const next = nextThreeState(current as ThreeState);

        const typePref = { ...prev[type] };
        if (next === undefined) {
          delete typePref[channel];
        } else {
          typePref[channel] = next;
        }

        const updated = { ...prev };
        if (Object.keys(typePref).length === 0) {
          delete updated[type];
        } else {
          updated[type] = typePref;
        }

        save(updated, digestFrequency);
        return updated;
      });
    },
    [digestFrequency, save],
  );

  const handleDigestChange = useCallback(
    (value: string | null) => {
      const freq = value === 'inherit' || value === null ? null : (value as DigestFrequency);
      setDigestFrequency(freq);
      save(prefs, freq);
    },
    [prefs, save],
  );

  if (loading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="sm" />
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {error && (
        <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      <Text size="sm" c="dimmed">
        {t(
          'Override your global notification preferences for this project. Click to cycle: inherit \u2192 on \u2192 off.',
        )}
      </Text>

      <Paper withBorder p="md">
        <Table verticalSpacing="sm" horizontalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ border: 'none' }}>
                <Text size="sm" fw={600}>
                  {t('Notification')}
                </Text>
              </Table.Th>
              {CHANNELS.map((ch) => {
                const { icon: Icon, label } = CHANNEL_META[ch];
                return (
                  <Table.Th key={ch} style={{ border: 'none', textAlign: 'center', width: 64 }}>
                    <Tooltip label={t(label)}>
                      <Group justify="center">
                        <Icon size={16} />
                      </Group>
                    </Tooltip>
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {PROJECT_TYPES.map((type) => (
              <Table.Tr key={type}>
                <Table.Td style={{ border: 'none' }}>
                  <Text size="sm">{t(TYPE_LABELS[type])}</Text>
                </Table.Td>
                {CHANNELS.map((ch) => {
                  const state = getThreeState(type, ch);
                  const { icon: Icon } = CHANNEL_META[ch];
                  const label = threeStateLabel(state);

                  return (
                    <Table.Td key={ch} style={{ border: 'none', textAlign: 'center' }}>
                      <Group justify="center">
                        <Tooltip label={label}>
                          <ActionIcon
                            variant={state === undefined ? 'subtle' : state ? 'filled' : 'default'}
                            color={state === true ? 'blue' : state === false ? 'red' : 'gray'}
                            size="sm"
                            radius="sm"
                            onClick={() => cycleThreeState(type, ch)}
                            aria-label={`${t(TYPE_LABELS[type])} ${t(CHANNEL_META[ch].label)} - ${label}`}
                          >
                            {state === undefined ? <Minus size={12} /> : <Icon size={12} />}
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Paper withBorder p="md">
        <Text size="sm" fw={600} mb="xs">
          {t('String update digest')}
        </Text>
        <Text size="xs" c="dimmed" mb="md">
          {t('Override the digest frequency for this project.')}
        </Text>
        <Select
          data={DIGEST_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
          value={digestFrequency ?? 'inherit'}
          onChange={handleDigestChange}
          w={200}
          allowDeselect={false}
        />
      </Paper>
    </Stack>
  );
}
