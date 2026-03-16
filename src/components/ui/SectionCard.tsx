/**
 * SectionCard — the standard content section used across all pages.
 *
 * Extracts the Account page pattern: Paper with border, optional title,
 * optional description, consistent padding and spacing.
 */

import type { ReactNode } from 'react';
import { Paper, Stack, Text, Group, type PaperProps } from '@mantine/core';

interface SectionCardProps extends Omit<PaperProps, 'title'> {
  /** Section heading. */
  title?: ReactNode;
  /** Small description below the title. */
  description?: string;
  /** Optional icon or badge next to the title. */
  titleRight?: ReactNode;
  /** Card content. */
  children: ReactNode;
}

export function SectionCard({
  title,
  description,
  titleRight,
  children,
  ...paperProps
}: SectionCardProps) {
  return (
    <Paper p="md" withBorder {...paperProps}>
      <Stack gap="sm">
        {(title || titleRight) && (
          <Group justify="space-between" align="center">
            {typeof title === 'string' ? (
              <Text size="sm" fw={500}>
                {title}
              </Text>
            ) : (
              title
            )}
            {titleRight}
          </Group>
        )}

        {description && (
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        )}

        {children}
      </Stack>
    </Paper>
  );
}
