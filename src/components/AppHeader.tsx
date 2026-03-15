/**
 * AppHeader — shared header for all cloud pages.
 *
 * Layout: branding left, page actions center, navigation + controls right.
 * Right-side: Explore, Dashboard (text buttons), theme toggle, user menu.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Group,
  Button,
  ActionIcon,
  Tooltip,
  useMantineColorScheme,
  useComputedColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion } from 'motion/react';
import { Sun, Moon, Globe, LayoutDashboard } from 'lucide-react';
import { sectionVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { useAuth } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-notifications';
import { UserMenu } from '@/components/auth/UserMenu';
import { NotificationBell } from '@/components/notifications';

const MotionDiv = motion.div;

interface AppHeaderProps {
  /** Extra buttons rendered in the right section before nav */
  actions?: ReactNode;
}

function ThemeToggle() {
  const { t } = useTranslation();
  const { toggleColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');

  return (
    <Tooltip label={computedColorScheme === 'dark' ? t('Light mode') : t('Dark mode')}>
      <motion.div {...buttonStates}>
        <ActionIcon
          variant="default"
          size="lg"
          onClick={toggleColorScheme}
          aria-label={
            computedColorScheme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode')
          }
        >
          {computedColorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </ActionIcon>
      </motion.div>
    </Tooltip>
  );
}

export function AppHeader({ actions }: AppHeaderProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme('light');
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  // Subscribe to notifications when authenticated
  useNotifications();

  return (
    <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
      <Group justify="space-between" align="center" mb="lg">
        {/* Left: branding */}
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            textDecoration: 'none',
          }}
        >
          <img
            src={
              computedColorScheme === 'dark'
                ? '/glossboss-combined-light.svg'
                : '/glossboss-combined-dark.svg'
            }
            alt="GlossBoss"
            style={{ height: 28, display: 'block' }}
          />
        </Link>

        {/* Right: actions + nav + controls */}
        <Group gap="sm" style={{ flex: '0 0 auto' }}>
          {actions}

          {!isMobile && (
            <>
              <motion.div {...buttonStates}>
                <Button
                  component={Link}
                  to="/explore"
                  variant="subtle"
                  leftSection={<Globe size={16} />}
                >
                  {t('Explore')}
                </Button>
              </motion.div>
              <motion.div {...buttonStates}>
                <Button
                  component={Link}
                  to="/dashboard"
                  variant="subtle"
                  leftSection={<LayoutDashboard size={16} />}
                >
                  {t('Dashboard')}
                </Button>
              </motion.div>
            </>
          )}

          {isAuthenticated && <NotificationBell />}
          <ThemeToggle />
          <UserMenu />
        </Group>
      </Group>
    </MotionDiv>
  );
}
