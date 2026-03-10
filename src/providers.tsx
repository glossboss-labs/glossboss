import type { ReactNode } from 'react';
import {
  MantineProvider,
  createTheme,
  Paper,
  Table,
  Modal,
  Menu,
  type CSSVariablesResolver,
} from '@mantine/core';
import { TranslationProvider } from '@/lib/app-language';

// Import Mantine styles
import '@mantine/core/styles.css';

/**
 * CSS Variables Resolver
 * Bridges design tokens to Mantine's CSS variable system per color scheme.
 *
 * Dark mode: OLED — true-black base, warm-tinted grays, wide luminance steps.
 * Light mode: Cool-tinted whites with clear surface hierarchy.
 */
const resolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--gb-surface-0': '#fafbfc',
    '--gb-surface-1': '#f3f4f6',
    '--gb-surface-2': '#ebedf0',
    '--gb-surface-3': '#e2e5e9',
    '--gb-border-subtle': '#e5e7eb',
    '--gb-border-default': '#d1d5db',
    '--gb-border-strong': '#b8bec6',
    '--gb-text-primary': '#111827',
    '--gb-text-secondary': '#4b5563',
    '--gb-text-tertiary': '#9ca3af',
    '--gb-glow-focus': 'rgba(59, 130, 246, 0.15)',
    '--gb-input-bg': '#eef0f3',
    '--gb-highlight-row': 'rgba(59, 130, 246, 0.06)',
    '--gb-highlight-danger': 'rgba(239, 68, 68, 0.04)',
    '--gb-table-stripe': 'rgba(0, 0, 0, 0.015)',
    '--mantine-color-body': '#fafbfc',
    '--mantine-color-default-border': '#e5e7eb',
  },
  dark: {
    '--gb-surface-0': '#050505',
    '--gb-surface-1': '#111111',
    '--gb-surface-2': '#191919',
    '--gb-surface-3': '#222222',
    '--gb-border-subtle': '#1c1c1c',
    '--gb-border-default': '#282828',
    '--gb-border-strong': '#383838',
    '--gb-text-primary': '#efefef',
    '--gb-text-secondary': '#a3a3a3',
    '--gb-text-tertiary': '#707070',
    '--gb-glow-focus': 'rgba(59, 130, 246, 0.3)',
    '--gb-input-bg': '#0a0a0a',
    '--gb-highlight-row': 'rgba(59, 130, 246, 0.08)',
    '--gb-highlight-danger': 'rgba(239, 68, 68, 0.06)',
    '--gb-table-stripe': 'rgba(255, 255, 255, 0.02)',
    '--mantine-color-body': '#050505',
    '--mantine-color-default-border': '#1c1c1c',
  },
});

/**
 * Mantine theme configuration
 * OLED dark base with Geist typography and premium surface elevation.
 * Light mode uses cool-tinted whites; dark mode uses warm-tinted true-blacks.
 */
const theme = createTheme({
  colors: {
    blue: [
      '#eff6ff',
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      '#3b82f6',
      '#2563eb',
      '#1d4ed8',
      '#1e40af',
      '#1e3a8a',
    ],
    dark: [
      '#efefef', // 0 - primary text
      '#a3a3a3', // 1 - dimmed text
      '#707070', // 2 - tertiary
      '#4a4a4a', // 3 - disabled
      '#282828', // 4 - default border
      '#1c1c1c', // 5 - subtle border
      '#191919', // 6 - component bg
      '#111111', // 7 - surface-1
      '#050505', // 8 - body bg
      '#000000', // 9 - deepest
    ],
  },
  primaryColor: 'blue',
  fontFamily: '"Geist Variable", system-ui, -apple-system, sans-serif',
  fontFamilyMonospace: '"Geist Mono Variable", ui-monospace, monospace',
  headings: {
    fontFamily: '"Geist Variable", system-ui, -apple-system, sans-serif',
  },
  defaultRadius: 'sm',
  components: {
    Paper: Paper.extend({
      defaultProps: { radius: 'md' },
      styles: {
        root: { backgroundColor: 'var(--gb-surface-1)' },
      },
    }),
    Table: Table.extend({
      defaultProps: { verticalSpacing: 'sm', horizontalSpacing: 'md' },
      styles: {
        table: {
          '--table-hover-color': 'var(--gb-highlight-row)',
          '--table-striped-color': 'var(--gb-table-stripe)',
        },
        thead: { backgroundColor: 'var(--gb-surface-2)' },
        th: {
          fontWeight: 600,
          fontSize: 'var(--mantine-font-size-xs)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.04em',
          color: 'var(--gb-text-secondary)',
        },
      },
    }),
    Modal: Modal.extend({
      styles: {
        content: {
          backgroundColor: 'var(--gb-surface-1)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
        },
        header: { backgroundColor: 'var(--gb-surface-1)' },
        overlay: { backdropFilter: 'blur(4px)' },
      },
    }),
    Menu: Menu.extend({
      styles: {
        dropdown: {
          backgroundColor: 'var(--gb-surface-2)',
          borderColor: 'var(--gb-border-subtle)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        },
      },
    }),
    Tooltip: {
      styles: {
        tooltip: { boxShadow: '0 4px 12px rgba(0,0,0,0.3)' },
      },
    },
    Notification: {
      styles: {
        root: {
          backgroundColor: 'var(--gb-surface-2)',
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        },
      },
    },
    Alert: {
      styles: {
        root: { borderColor: 'var(--gb-border-subtle)' },
      },
    },
    TextInput: {
      defaultProps: { size: 'sm' },
      styles: {
        input: {
          backgroundColor: 'var(--gb-input-bg)',
          borderColor: 'var(--gb-border-subtle)',
        },
      },
    },
    Textarea: {
      styles: {
        input: {
          backgroundColor: 'var(--gb-input-bg)',
          borderColor: 'var(--gb-border-subtle)',
        },
      },
    },
    Select: {
      styles: {
        input: {
          backgroundColor: 'var(--gb-input-bg)',
          borderColor: 'var(--gb-border-subtle)',
        },
      },
    },
    Button: {
      defaultProps: { size: 'sm' },
      styles: {
        root: { fontWeight: 600 },
      },
    },
    ActionIcon: {
      styles: {
        root: { transition: 'background-color 120ms ease' },
      },
    },
  },
});

/**
 * App-wide providers
 *
 * - MantineProvider: UI component library (auto color scheme = follows OS)
 * - TranslationProvider: i18n
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto" cssVariablesResolver={resolver}>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}
