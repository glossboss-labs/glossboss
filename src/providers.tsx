import { type ReactNode, useEffect } from 'react';
import {
  MantineProvider,
  createTheme,
  Paper,
  Table,
  Modal,
  Menu,
  Badge,
  Tabs,
  SegmentedControl,
  Progress,
  type CSSVariablesResolver,
} from '@mantine/core';
import { TranslationProvider } from '@/lib/app-language';
import { useAuthStore } from '@/stores/auth-store';

// Import Mantine styles
import '@mantine/core/styles.css';

/**
 * CSS Variables Resolver
 *
 * Dark mode: true-black OLED base, neutral grays, Vercel-inspired.
 * Light mode: clean whites with minimal contrast hierarchy.
 *
 * Design philosophy: monochrome by default, color only for status/actions.
 */
const resolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--gb-surface-0': '#ffffff',
    '--gb-surface-1': '#fafafa',
    '--gb-surface-2': '#f5f5f5',
    '--gb-surface-3': '#ebebeb',
    '--gb-border-subtle': '#eaeaea',
    '--gb-border-default': '#e0e0e0',
    '--gb-border-strong': '#cccccc',
    '--gb-text-primary': '#171717',
    '--gb-text-secondary': '#666666',
    '--gb-text-tertiary': '#999999',
    '--gb-glow-focus': 'rgba(0, 112, 243, 0.15)',
    '--gb-input-bg': '#ffffff',
    '--gb-highlight-row': 'rgba(0, 0, 0, 0.03)',
    '--gb-highlight-danger': 'rgba(239, 68, 68, 0.04)',
    '--gb-table-stripe': 'rgba(0, 0, 0, 0.015)',
    '--gb-shadow-modal': '0 16px 70px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
    '--gb-shadow-menu': '0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
    '--gb-shadow-tooltip': '0 2px 8px rgba(0,0,0,0.08)',
    '--gb-shadow-notification': '0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
    '--mantine-color-body': '#ffffff',
    '--mantine-color-default-border': '#eaeaea',
  },
  dark: {
    '--gb-surface-0': '#0a0a0a',
    '--gb-surface-1': '#141414',
    '--gb-surface-2': '#1c1c1c',
    '--gb-surface-3': '#252525',
    '--gb-border-subtle': '#262626',
    '--gb-border-default': '#333333',
    '--gb-border-strong': '#444444',
    '--gb-text-primary': '#ededed',
    '--gb-text-secondary': '#a1a1a1',
    '--gb-text-tertiary': '#666666',
    '--gb-glow-focus': 'rgba(0, 112, 243, 0.25)',
    '--gb-input-bg': '#111111',
    '--gb-highlight-row': 'rgba(255, 255, 255, 0.05)',
    '--gb-highlight-danger': 'rgba(239, 68, 68, 0.06)',
    '--gb-table-stripe': 'rgba(255, 255, 255, 0.02)',
    '--gb-shadow-modal': '0 25px 50px -12px rgba(0,0,0,0.7)',
    '--gb-shadow-menu': '0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
    '--gb-shadow-tooltip': '0 4px 12px rgba(0,0,0,0.4)',
    '--gb-shadow-notification': '0 8px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
    '--mantine-color-body': '#0a0a0a',
    '--mantine-color-default-border': '#262626',
  },
});

/**
 * Mantine theme — Vercel/Linear-inspired design system.
 *
 * Key principles:
 * - Tight radius (6px default, not round)
 * - Compact spacing (sm default sizes)
 * - Flat surfaces (no distinct card backgrounds)
 * - Monochrome UI, color reserved for status and actions
 * - Geist font family
 */
const theme = createTheme({
  colors: {
    blue: [
      '#f0f7ff',
      '#dbeafe',
      '#bfdbfe',
      '#93c5fd',
      '#60a5fa',
      '#0070f3', // Vercel blue
      '#0060df',
      '#1d4ed8',
      '#1e40af',
      '#1e3a8a',
    ],
    dark: [
      '#ededed', // 0 - primary text
      '#a1a1a1', // 1 - dimmed text
      '#666666', // 2 - tertiary
      '#444444', // 3 - disabled
      '#333333', // 4 - default border
      '#262626', // 5 - subtle border
      '#1c1c1c', // 6 - component bg
      '#141414', // 7 - surface-1
      '#0a0a0a', // 8 - body bg
      '#000000', // 9 - deepest
    ],
  },
  primaryColor: 'blue',
  fontFamily: '"Geist Variable", system-ui, -apple-system, sans-serif',
  fontFamilyMonospace: '"Geist Mono Variable", ui-monospace, monospace',
  headings: {
    fontFamily: '"Geist Variable", system-ui, -apple-system, sans-serif',
    fontWeight: '600',
  },

  // Tight radius scale: 4, 6, 8, 12, 16
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },
  defaultRadius: 'sm',

  // Tighter spacing scale
  spacing: {
    xs: '6px',
    sm: '10px',
    md: '14px',
    lg: '20px',
    xl: '28px',
  },

  components: {
    Paper: Paper.extend({
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          backgroundColor: 'var(--gb-surface-1)',
        },
      },
    }),
    Table: Table.extend({
      defaultProps: { verticalSpacing: '10', horizontalSpacing: 'sm' },
      styles: {
        table: {
          '--table-hover-color': 'var(--gb-highlight-row)',
          '--table-striped-color': 'var(--gb-table-stripe)',
        },
        thead: { backgroundColor: 'var(--gb-surface-2)' },
        th: {
          fontWeight: 500,
          fontSize: '12px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.04em',
          color: 'var(--gb-text-tertiary)',
        },
      },
    }),
    Modal: Modal.extend({
      defaultProps: { radius: 'md' },
      styles: {
        content: {
          backgroundColor: 'var(--gb-surface-1)',
          boxShadow: 'var(--gb-shadow-modal)',
          border: '1px solid var(--gb-border-subtle)',
        },
        header: {
          backgroundColor: 'var(--gb-surface-1)',
        },
        overlay: { backdropFilter: 'blur(4px)' },
      },
    }),
    Menu: Menu.extend({
      defaultProps: { radius: 'md' },
      styles: {
        dropdown: {
          backgroundColor: 'var(--gb-surface-1)',
          borderColor: 'var(--gb-border-subtle)',
          boxShadow: 'var(--gb-shadow-menu)',
        },
      },
    }),
    Tooltip: {
      defaultProps: { radius: 'sm' },
      styles: {
        tooltip: { boxShadow: 'var(--gb-shadow-tooltip)' },
      },
    },
    Notification: {
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          backgroundColor: 'var(--gb-surface-1)',
          boxShadow: 'var(--gb-shadow-notification)',
          border: '1px solid var(--gb-border-subtle)',
        },
      },
    },
    Alert: {
      defaultProps: { radius: 'md' },
      styles: {
        root: { borderColor: 'var(--gb-border-subtle)' },
      },
    },
    Badge: Badge.extend({
      defaultProps: { radius: 'xl' },
    }),
    TextInput: {
      defaultProps: { size: 'sm', radius: 'sm' },
      styles: {
        input: {
          backgroundColor: 'var(--gb-input-bg)',
          borderColor: 'var(--gb-border-default)',
        },
      },
    },
    PasswordInput: {
      defaultProps: { size: 'sm', radius: 'sm' },
      styles: {
        input: {
          backgroundColor: 'var(--gb-input-bg)',
          borderColor: 'var(--gb-border-default)',
        },
      },
    },
    Textarea: {
      defaultProps: { radius: 'sm' },
      styles: {
        input: {
          backgroundColor: 'var(--gb-input-bg)',
          borderColor: 'var(--gb-border-default)',
        },
      },
    },
    Select: {
      defaultProps: { size: 'sm', radius: 'sm' },
      styles: {
        input: {
          backgroundColor: 'var(--gb-input-bg)',
          borderColor: 'var(--gb-border-default)',
        },
      },
    },
    Button: {
      defaultProps: { size: 'sm', radius: 'sm' },
      styles: {
        root: { fontWeight: 500 },
      },
    },
    ActionIcon: {
      defaultProps: { radius: 'sm' },
      styles: {
        root: { transition: 'background-color 120ms ease' },
      },
    },
    Tabs: Tabs.extend({
      defaultProps: { radius: 'sm' },
    }),
    SegmentedControl: SegmentedControl.extend({
      defaultProps: { radius: 'sm' },
    }),
    Progress: Progress.extend({
      defaultProps: { radius: 'xl' },
    }),
  },
});

/**
 * App-wide providers
 *
 * - MantineProvider: UI component library (auto color scheme = follows OS)
 * - TranslationProvider: i18n
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  return (
    <MantineProvider theme={theme} defaultColorScheme="auto" cssVariablesResolver={resolver}>
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}
