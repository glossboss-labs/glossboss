/**
 * Keybinds Section — keyboard shortcuts with platform-aware key caps.
 *
 * Detects macOS vs Windows/Linux and shows the appropriate symbols:
 * Mac: ⌘ ⇧ ⌥ ⌃ ⎋ ⏎ ⇥    Windows/Linux: Ctrl Shift Alt Enter Tab Esc
 */

import { Stack, Text, Group, Paper, Table, Switch, Divider, Box } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { NAV_SKIP_TRANSLATED_KEY } from '@/components/editor/EditorTable';
import { msgid, useTranslation } from '@/lib/app-language';

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform ?? '');

/** Platform-aware key label mapping */
function keyLabel(key: string): string {
  if (isMac) {
    switch (key) {
      case 'Mod':
        return '⌘';
      case 'Ctrl':
        return '⌃';
      case 'Shift':
        return '⇧';
      case 'Alt':
        return '⌥';
      case 'Enter':
        return '⏎';
      case 'Tab':
        return '⇥';
      case 'Escape':
        return '⎋';
      default:
        return key;
    }
  }
  switch (key) {
    case 'Mod':
      return 'Ctrl';
    default:
      return key;
  }
}

/** Keyboard shortcut definitions using platform-neutral keys */
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
    keys: [['Mod', 'Enter']],
    action: msgid('Next entry'),
    description: msgid('Save and jump to the next translation entry (skips translated by default)'),
  },
  {
    keys: [['Escape']],
    action: msgid('Cancel edit'),
    description: msgid('Discard changes and exit the current field'),
  },
];

/** Single key cap styled as a physical keyboard key */
function KeyCap({ label }: { label: string }) {
  const isSymbol = label.length === 1 && /[⌘⇧⌥⌃⏎⇥⎋]/.test(label);
  return (
    <Box
      component="kbd"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: isSymbol ? 28 : undefined,
        height: 28,
        padding: '0 8px',
        borderRadius: 6,
        border: '1px solid var(--gb-border-default)',
        backgroundColor: 'var(--gb-surface-2)',
        boxShadow: '0 1px 0 var(--gb-border-default)',
        fontSize: isSymbol ? 16 : 12,
        fontFamily: isSymbol ? 'inherit' : 'var(--mantine-font-family-monospace)',
        fontWeight: 500,
        lineHeight: 1,
        color: 'var(--gb-text-primary)',
      }}
    >
      {label}
    </Box>
  );
}

/** Renders a key combination as styled key caps */
function KeyCombo({ keys }: { keys: string[][] }) {
  return (
    <Group gap={6} wrap="nowrap">
      {keys.map((combo, ci) => (
        <Group key={ci} gap={4} wrap="nowrap" align="center">
          {ci > 0 && (
            <Text size="xs" c="dimmed">
              /
            </Text>
          )}
          {combo.map((key, ki) => (
            <Group key={ki} gap={3} wrap="nowrap" align="center">
              {ki > 0 && !isMac && (
                <Text size="xs" c="dimmed">
                  +
                </Text>
              )}
              <KeyCap label={keyLabel(key)} />
            </Group>
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
              <Table.Th style={{ width: '30%' }}>{t('Shortcut')}</Table.Th>
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
          'When using {{key}}+Enter, skip entries that are already translated and jump to the next untranslated or fuzzy entry',
          { key: isMac ? '⌘' : 'Ctrl' },
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
