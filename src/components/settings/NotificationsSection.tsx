/**
 * NotificationsSection — global notification preferences.
 *
 * Single list with toggle buttons per channel (in-app, email, push)
 * for each notification type, plus digest frequency for string updates.
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
  Divider,
  Tooltip,
  Table,
} from '@mantine/core';
import { MessageCircle, Mail, BellRing } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { msgid } from '@/lib/app-language';
import {
  getNotificationPreferences,
  upsertNotificationPreferences,
} from '@/lib/notifications/preferences-api';
import type {
  NotificationType,
  NotificationChannelPrefs,
  NotificationChannel,
  DigestFrequency,
} from '@/lib/notifications/types';
import { CONFIGURABLE_TYPES } from '@/lib/notifications/types';

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

const CHANNEL_META: Record<NotificationChannel, { icon: typeof Bell; label: string }> = {
  in_app: { icon: MessageCircle, label: msgid('In-app') },
  email: { icon: Mail, label: msgid('Email') },
  push: { icon: BellRing, label: msgid('Push') },
};

const CHANNELS: NotificationChannel[] = ['in_app', 'email', 'push'];

const DIGEST_OPTIONS = [
  { value: 'hourly', label: msgid('Hourly') },
  { value: 'daily', label: msgid('Daily') },
  { value: 'weekly', label: msgid('Weekly') },
  { value: 'off', label: msgid('Off') },
];

export function NotificationsSection() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<Partial<Record<NotificationType, NotificationChannelPrefs>>>(
    {},
  );
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>('daily');
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getNotificationPreferences()
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
          // Gracefully handle missing table (e.g. dev env without migrations)
          console.warn('Failed to load notification preferences:', err);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const save = useCallback(
    (
      newPrefs: Partial<Record<NotificationType, NotificationChannelPrefs>>,
      newDigest: DigestFrequency,
    ) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        upsertNotificationPreferences(newPrefs, newDigest).catch((err) => {
          console.error('Failed to save notification preferences:', err);
        });
      }, 600);
    },
    [],
  );

  const toggleChannel = useCallback(
    (type: NotificationType, channel: NotificationChannel) => {
      setPrefs((prev) => {
        const current = prev[type]?.[channel] ?? true;
        const updated = {
          ...prev,
          [type]: { ...prev[type], [channel]: !current },
        };
        save(updated, digestFrequency);
        return updated;
      });
    },
    [digestFrequency, save],
  );

  const getChannelValue = (type: NotificationType, channel: NotificationChannel): boolean => {
    return prefs[type]?.[channel] ?? true;
  };

  const handleDigestChange = useCallback(
    (value: string | null) => {
      const freq = (value ?? 'daily') as DigestFrequency;
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
            {CONFIGURABLE_TYPES.map((type) => (
              <Table.Tr key={type}>
                <Table.Td style={{ border: 'none' }}>
                  <Text size="sm">{t(TYPE_LABELS[type])}</Text>
                </Table.Td>
                {CHANNELS.map((ch) => {
                  const active = getChannelValue(type, ch);
                  return (
                    <Table.Td key={ch} style={{ border: 'none', textAlign: 'center' }}>
                      <Group justify="center">
                        <ActionIcon
                          variant={active ? 'filled' : 'default'}
                          color={active ? 'blue' : 'gray'}
                          size="sm"
                          radius="sm"
                          onClick={() => toggleChannel(type, ch)}
                          aria-label={`${t(TYPE_LABELS[type])} ${t(CHANNEL_META[ch].label)}`}
                        >
                          {(() => {
                            const { icon: Icon } = CHANNEL_META[ch];
                            return <Icon size={12} />;
                          })()}
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Digest frequency */}
      <Paper withBorder p="md">
        <Text size="sm" fw={600} mb="xs">
          {t('String update digest')}
        </Text>
        <Text size="xs" c="dimmed" mb="md">
          {t('How often to receive batched notifications about string changes in your projects.')}
        </Text>
        <Select
          data={DIGEST_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
          value={digestFrequency}
          onChange={handleDigestChange}
          w={200}
          allowDeselect={false}
        />
      </Paper>

      <Divider />

      <Text size="xs" c="dimmed">
        {t("Per-project notification overrides are available in each project's settings.")}
      </Text>
    </Stack>
  );
}
