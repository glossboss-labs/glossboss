import { Badge, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useTranslation } from '@/lib/app-language';
import { useEditorStore } from '@/stores';

export function ReviewSummary() {
  const { t } = useTranslation();
  const { reviewerName, lockApprovedEntries, setReviewerName, setLockApprovedEntries, getStats } =
    useEditorStore();

  const stats = getStats();

  return (
    <Stack gap="xs">
      <Group gap="xs" align="center">
        <Text size="sm" fw={600}>
          {t('Review workflow')}
        </Text>
        <Badge color={stats.readyToExport ? 'green' : 'gray'} variant="light" size="sm">
          {stats.readyToExport ? t('Ready for export') : t('Review in progress')}
        </Badge>
      </Group>
      <Group gap="sm" align="flex-end" wrap="wrap">
        <TextInput
          value={reviewerName}
          onChange={(event) => setReviewerName(event.currentTarget.value)}
          placeholder={t('Current editor')}
          size="xs"
          w={180}
          aria-label={t('Reviewer name')}
        />
        <Switch
          label={t('Lock approved strings')}
          checked={lockApprovedEntries}
          onChange={(event) => setLockApprovedEntries(event.currentTarget.checked)}
          size="xs"
          styles={{ body: { alignItems: 'center' } }}
        />
      </Group>
    </Stack>
  );
}
