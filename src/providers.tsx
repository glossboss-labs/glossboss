import { ReactNode } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';

// Import Mantine styles
import '@mantine/core/styles.css';

/**
 * Mantine theme configuration
 * Lightweight, clean defaults focused on usability
 */
const theme = createTheme({
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
      {children}
    </MantineProvider>
  );
}
