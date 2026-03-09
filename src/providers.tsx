import type { ReactNode } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { TranslationProvider } from '@/lib/app-language';

// Import Mantine styles
import '@mantine/core/styles.css';

/**
 * Mantine theme configuration
 * Lightweight, clean defaults focused on usability
 */
const theme = createTheme({
  colors: {
    dark: [
      '#e5e5e5',
      '#a3a3a3',
      '#525252',
      '#404040',
      '#262626',
      '#1a1a1a',
      '#141414',
      '#0a0a0a',
      '#050505',
      '#020202',
    ],
  },
  primaryColor: 'blue',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  defaultRadius: 'sm',
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
      },
    },
    TextInput: {
      defaultProps: {
        size: 'sm',
      },
    },
    Table: {
      defaultProps: {
        verticalSpacing: 'sm',
        horizontalSpacing: 'md',
      },
    },
  },
});

/**
 * App-wide providers
 *
 * - MantineProvider: UI component library
 * - Add additional providers here as needed (e.g., notifications)
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <TranslationProvider>{children}</TranslationProvider>
    </MantineProvider>
  );
}
