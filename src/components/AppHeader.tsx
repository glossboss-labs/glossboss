/**
 * AppHeader — shared header for project pages (Dashboard, ProjectDetail, ProjectEditor).
 *
 * Three-column layout: branding left, page actions center, controls right.
 * Right-side controls: Feedback button, theme toggle, dashboard link, user menu.
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  Group,
  Text,
  Button,
  ActionIcon,
  Divider,
  Tooltip,
  useMantineColorScheme,
  useComputedColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion } from 'motion/react';
import { Sun, Moon, MessageSquare, LayoutDashboard, Home, Globe } from 'lucide-react';
import { sectionVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { UserMenu } from '@/components/auth/UserMenu';
import { FeedbackModal } from '@/components/feedback';

const MotionDiv = motion.div;

interface AppHeaderProps {
  /** Extra buttons rendered in the center section */
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
  const theme = useMantineTheme();
  const computedColorScheme = useComputedColorScheme('light');
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <>
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Group justify="space-between" align="center" mb="lg">
          {/* Left: branding */}
          <Group gap="sm" align="center" style={{ flex: '0 0 auto' }}>
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
            <Tooltip label={t('Open local editor')}>
              <Text
                component={Link}
                to="/"
                size="xs"
                style={{
                  color: 'var(--gb-text-tertiary)',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Home size={12} />
                {t('Editor')}
              </Text>
            </Tooltip>
          </Group>

          {/* Right: actions + controls */}
          <Group gap="sm" style={{ flex: '0 0 auto' }}>
            {actions}

            {!isMobile && <Divider orientation="vertical" />}

            {!isMobile && (
              <Group gap="sm">
                <Tooltip label={t('Share feedback')}>
                  <motion.div {...buttonStates}>
                    <Button
                      variant="subtle"
                      leftSection={<MessageSquare size={16} />}
                      onClick={() => setFeedbackOpen(true)}
                    >
                      {t('Feedback')}
                    </Button>
                  </motion.div>
                </Tooltip>

                <ThemeToggle />
              </Group>
            )}

            <Tooltip label={t('Explore')}>
              <motion.div {...buttonStates}>
                <ActionIcon
                  component={Link}
                  to="/explore"
                  variant="default"
                  size="lg"
                  aria-label={t('Explore')}
                >
                  <Globe size={18} />
                </ActionIcon>
              </motion.div>
            </Tooltip>

            <Tooltip label={t('Projects')}>
              <motion.div {...buttonStates}>
                <ActionIcon
                  component={Link}
                  to="/dashboard"
                  variant="default"
                  size="lg"
                  aria-label={t('Projects')}
                >
                  <LayoutDashboard size={18} />
                </ActionIcon>
              </motion.div>
            </Tooltip>

            <UserMenu />
          </Group>
        </Group>
      </MotionDiv>

      <FeedbackModal opened={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
