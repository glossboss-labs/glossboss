import { Badge, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useTranslation } from '@/lib/app-language';
import { useEditorStore } from '@/stores';

export function ReviewSummary() {
  const { t } = useTranslation();
  const { reviewerName, lockApprovedEntries, setReviewerName, setLockApprovedEntries, getStats } =
    useEditorStore();

  const stats = getStats();

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Group gap="xs" wrap="wrap" align="center">
          <Text size="sm" fw={600}>
            {t('Review workflow')}
          </Text>
          <Badge color={stats.readyToExport ? 'green' : 'gray'} variant="light" size="sm">
            {stats.readyToExport ? t('Ready for export') : t('Review in progress')}
          </Badge>
          <Badge color="gray" variant="light">
            {t('Draft {{count}}', { count: stats.reviewDraft })}
          </Badge>
          <Badge color="blue" variant="light">
            {t('In review {{count}}', { count: stats.reviewInReview })}
          </Badge>
          <Badge color="green" variant="light">
            {t('Approved {{count}}', { count: stats.reviewApproved })}
          </Badge>
          <Badge color="orange" variant="light">
            {t('Needs changes {{count}}', { count: stats.reviewNeedsChanges })}
          </Badge>
          <Badge color={stats.reviewUnresolved > 0 ? 'red' : 'gray'} variant="light">
            {t('Unresolved comments {{count}}', { count: stats.reviewUnresolved })}
          </Badge>
          <Badge color={stats.reviewChanged > 0 ? 'violet' : 'gray'} variant="light">
            {t('Changed strings {{count}}', { count: stats.reviewChanged })}
          </Badge>
        </Group>

        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            label={t('Reviewer name')}
            value={reviewerName}
            onChange={(event) => setReviewerName(event.currentTarget.value)}
            placeholder={t('Current editor')}
            size="xs"
            w={220}
          />
          <Switch
            label={t('Lock approved strings')}
            description={t('Approved strings become read-only until they are reopened.')}
            checked={lockApprovedEntries}
            onChange={(event) => setLockApprovedEntries(event.currentTarget.checked)}
            size="sm"
            styles={{ body: { alignItems: 'center' } }}
          />
        </Group>
      </Group>
    </Stack>
  );
}
