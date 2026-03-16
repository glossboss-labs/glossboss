/**
 * CollapsibleSection — a section with a clickable header that toggles content visibility.
 *
 * Used in the Inspector sidebar to let users expand/collapse sections like
 * Translation Memory, QA Checks, References, etc.
 */

import { useState, type ReactNode } from 'react';
import { UnstyledButton, Group, Text, Collapse, Stack, Divider } from '@mantine/core';
import { ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  /** Section title. */
  title: string;
  /** Optional count/status badge next to the title. */
  badge?: ReactNode;
  /** Whether the section starts open. */
  defaultOpen?: boolean;
  /** Section content. */
  children: ReactNode;
  /** Show a top divider above the section. */
  withDivider?: boolean;
}

export function CollapsibleSection({
  title,
  badge,
  defaultOpen = false,
  children,
  withDivider = true,
}: CollapsibleSectionProps) {
  const [opened, setOpened] = useState(defaultOpen);

  return (
    <>
      {withDivider && <Divider />}
      <Stack gap={6}>
        <UnstyledButton onClick={() => setOpened((o) => !o)} style={{ width: '100%' }}>
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap={6} wrap="nowrap">
              <ChevronRight
                size={14}
                style={{
                  transform: opened ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 150ms ease',
                  color: 'var(--gb-text-tertiary)',
                  flexShrink: 0,
                }}
              />
              <Text size="xs" fw={600} c="dimmed">
                {title}
              </Text>
            </Group>
            {badge}
          </Group>
        </UnstyledButton>
        <Collapse in={opened}>
          <Stack gap={6}>{children}</Stack>
        </Collapse>
      </Stack>
    </>
  );
}
