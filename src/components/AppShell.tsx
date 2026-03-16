/**
 * AppShell — layout wrapper for all cloud pages.
 *
 * Provides the persistent sidebar + main content area via Outlet.
 * Editor pages opt out of this layout and use their own full-width header.
 */

import { Outlet } from 'react-router';
import { AppShell as MantineAppShell, Burger, Group, useMantineTheme } from '@mantine/core';
import { useDisclosure, useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { useNotifications } from '@/hooks/use-notifications';
import { AppSidebar } from './AppSidebar';

const COLLAPSED_KEY = 'gb-sidebar-collapsed';

export function CloudAppShell() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();
  const [collapsed, setCollapsed] = useLocalStorage({
    key: COLLAPSED_KEY,
    defaultValue: false,
  });

  // Subscribe to notifications at the shell level
  useNotifications();

  const navWidth = isMobile ? 240 : collapsed ? 52 : 200;

  return (
    <MantineAppShell
      navbar={{
        width: navWidth,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      padding="lg"
      styles={{
        navbar: {
          backgroundColor: 'var(--mantine-color-body)',
          borderRight: '1px solid var(--gb-border-subtle)',
        },
        main: {
          backgroundColor: 'var(--mantine-color-body)',
        },
      }}
    >
      <MantineAppShell.Navbar>
        <AppSidebar
          collapsed={isMobile ? false : collapsed}
          onToggle={() => {
            if (isMobile) {
              closeMobile();
            } else {
              setCollapsed(!collapsed);
            }
          }}
        />
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        {/* Mobile burger */}
        {isMobile && (
          <Group mb="sm">
            <Burger opened={mobileOpened} onClick={toggleMobile} size="sm" />
          </Group>
        )}
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
