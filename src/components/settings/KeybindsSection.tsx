/**
 * Keybinds Section — keyboard shortcuts table, skip-translated toggle.
 */

import { Stack, Text, Group, Paper, Table, Kbd, Switch, Divider } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { NAV_SKIP_TRANSLATED_KEY } from '@/components/editor/EditorTable';
import { msgid, useTranslation } from '@/lib/app-language';

/** Keyboard shortcut definitions */
const KEYBINDS: { keys: string[][]; action: string; description?: string }[] = [
  {
    keys: [['Tab']],
    action: msgid('Next field'),
    description: msgid('Save current field and move to the next translation field'),
  },
  {
    keys: [['Shift', 'Tab']],
    action: msgid('Previous field'),
    description: msgid('Save current field and move to the previous translation field'),
  },
  {
    keys: [['Enter']],
    action: msgid('Next field'),
    description: msgid('Save current field and move to the next translation field'),
  },
  {
    keys: [['Shift', 'Enter']],
    action: msgid('New line'),
    description: msgid('Insert a line break in the translation'),
  },
  {
    keys: [
      ['⌘', 'Enter'],
      ['Ctrl', 'Enter'],
    ],
    action: msgid('Next entry'),
    description: msgid('Save and jump to the next translation entry (skips translated by default)'),
  },
  {
    keys: [['Escape']],
    action: msgid('Cancel edit'),
    description: msgid('Discard changes and exit the current field'),
  },
];

/** Renders a key combination using Mantine Kbd components */
function KeyCombo({ keys }: { keys: string[][] }) {
  return (
    <Group gap={6}>
      {keys.map((combo, ci) => (
        <Group key={ci} gap={4} wrap="nowrap">
          {ci > 0 && (
            <Text size="xs" c="dimmed" aria-hidden="true">
              /
            </Text>
          )}
          {combo.map((key, ki) => (
            <span key={ki} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {ki > 0 && (
                <Text size="xs" c="dimmed" aria-hidden="true">
                  +
                </Text>
              )}
              <Kbd size="sm">{key}</Kbd>
            </span>
          ))}
        </Group>
      ))}
    </Group>
  );
}

export function KeybindsSection() {
  const { t } = useTranslation();
  const [skipTranslated, setSkipTranslated] = useLocalStorage<boolean>({
    key: NAV_SKIP_TRANSLATED_KEY,
    defaultValue: true,
  });

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t('Keyboard shortcuts available when editing translations.')}
      </Text>

      <Paper withBorder>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: '35%' }}>{t('Shortcut')}</Table.Th>
              <Table.Th style={{ width: '20%' }}>{t('Action')}</Table.Th>
              <Table.Th>{t('Description')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {KEYBINDS.map((bind, i) => (
              <Table.Tr key={i}>
                <Table.Td>
                  <KeyCombo keys={bind.keys} />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {t(bind.action)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {bind.description ? t(bind.description) : null}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      <Divider />

      <Text size="sm" fw={500}>
        {t('Navigation Settings')}
      </Text>

      <Switch
        label={t('Skip translated entries')}
        description={t(
          'When using ⌘/Ctrl+Enter, skip entries that are already translated and jump to the next untranslated or fuzzy entry',
        )}
        checked={skipTranslated}
        onChange={(e) => setSkipTranslated(e.currentTarget.checked)}
        styles={{
          track: {
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
          },
          thumb: {
            transition: 'transform 0.2s ease, left 0.2s ease',
          },
        }}
      />
    </Stack>
  );
}
