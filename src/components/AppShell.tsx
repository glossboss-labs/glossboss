/**
 * AppShell — layout wrapper for all pages with sidebar.
 *
 * Provides the persistent sidebar + main content area via Outlet.
 * Sidebar width is resizable via drag handle, persisted in localStorage.
 */

import { useCallback, useRef } from 'react';
import { Outlet } from 'react-router';
import { AppShell as MantineAppShell, Burger, Group, Box, useMantineTheme } from '@mantine/core';
import { useDisclosure, useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { useNotifications } from '@/hooks/use-notifications';
import { AppSidebar } from './AppSidebar';
import { DevBranchChip } from '@/pages/index/DevBranchChip';
import {
  DEV_BRANCH_CHIP_KEY,
  SIDEBAR_COLLAPSED_KEY,
  SIDEBAR_WIDTH_KEY,
} from '@/lib/constants/storage-keys';

const DEV_BRANCH_CHIP_STORAGE_KEY = DEV_BRANCH_CHIP_KEY;
const COLLAPSED_KEY = SIDEBAR_COLLAPSED_KEY;
const WIDTH_KEY = SIDEBAR_WIDTH_KEY;
const DEFAULT_WIDTH = 200;
const MIN_WIDTH = 160;
const MAX_WIDTH = 320;
const COLLAPSED_WIDTH = 52;

export function CloudAppShell() {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();
  const [collapsed, setCollapsed] = useLocalStorage({
    key: COLLAPSED_KEY,
    defaultValue: false,
  });
  const [sidebarWidth, setSidebarWidth] = useLocalStorage({
    key: WIDTH_KEY,
    defaultValue: DEFAULT_WIDTH,
  });
  const resizingRef = useRef(false);
  const isDevelopment = import.meta.env.DEV;
  const [branchChipEnabled] = useLocalStorage<boolean>({
    key: DEV_BRANCH_CHIP_STORAGE_KEY,
    defaultValue: true,
    getInitialValueInEffect: false,
  });

  // Subscribe to notifications at the shell level
  useNotifications();

  const navWidth = isMobile ? 240 : collapsed ? COLLAPSED_WIDTH : sidebarWidth;

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      if (collapsed || isMobile) return;
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = true;
      const startX = e.clientX;
      const startWidth = sidebarWidth;

      const handleMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        setSidebarWidth(nextWidth);
      };

      const handleUp = () => {
        resizingRef.current = false;
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [collapsed, isMobile, sidebarWidth, setSidebarWidth],
  );

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
          borderRight: 'none',
          overflow: 'visible',
        },
        main: {
          backgroundColor: 'var(--mantine-color-body)',
        },
      }}
    >
      <MantineAppShell.Navbar>
        <Box style={{ display: 'flex', height: '100%' }}>
          <Box style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
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
          </Box>

          {/* Resize handle */}
          {!isMobile && !collapsed && (
            <Box
              onPointerDown={handleResizeStart}
              style={{
                width: 4,
                flexShrink: 0,
                cursor: 'col-resize',
                borderRight: '1px solid var(--gb-border-subtle)',
                transition: 'background-color 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--gb-highlight-row)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            />
          )}

          {/* Border line when collapsed (no resize handle) */}
          {!isMobile && collapsed && (
            <Box
              style={{
                width: 1,
                flexShrink: 0,
                backgroundColor: 'var(--gb-border-subtle)',
              }}
            />
          )}
        </Box>
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
      {isDevelopment && branchChipEnabled && <DevBranchChip branch={__GIT_BRANCH__} />}
    </MantineAppShell>
  );
}
