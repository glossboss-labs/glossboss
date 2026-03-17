/**
 * Shared renderOption for Mantine Select components that show country flags.
 *
 * Expects each option's `value` to be a language/locale code (e.g. "nl", "EN-GB").
 * Renders a CountryFlag badge next to the label text.
 */

import { Group, Text } from '@mantine/core';
import type { ComboboxItem } from '@mantine/core';
import { CountryFlag } from './CountryFlag';

interface RenderOptionProps {
  option: ComboboxItem;
  checked: boolean;
}

export function renderFlagOption({ option }: RenderOptionProps) {
  return (
    <Group gap={8} wrap="nowrap">
      <CountryFlag code={option.value} size="xs" />
      <Text size="sm" truncate>
        {option.label}
      </Text>
    </Group>
  );
}
