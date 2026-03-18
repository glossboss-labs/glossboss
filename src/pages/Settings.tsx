/**
 * Settings — full-page app settings with tabbed navigation.
 *
 * Replaces the SettingsModal with a dedicated route at /settings.
 * Tab state persisted in the URL via ?tab= search parameter.
 */

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Stack, Title, Tabs, useMantineTheme, Box } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion } from 'motion/react';
import {
  User,
  Key,
  Volume2,
  BookOpen,
  Keyboard,
  Monitor,
  Download,
  GitBranch,
  CreditCard,
  Bell,
} from 'lucide-react';
import { staggerPageVariants, fadeVariants } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { trackEvent } from '@/lib/analytics';
import { useAuth } from '@/hooks/use-auth';
import { useSettingsTour } from '@/hooks/use-editor-tour';
import { AnimatedTabPanel } from '@/components/ui';
import {
  AccountSection,
  TranslationSection,
  SpeechSection,
  GlossarySection,
  KeybindsSection,
  DisplaySection,
  BackupSection,
  BillingSection,
  DevelopmentSection,
  DeleteAccountSection,
  DataExportSection,
  NotificationsSection,
} from '@/components/settings';

const MotionDiv = motion.div;

export default function Settings() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const isDevelopment = import.meta.env.DEV;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || (isAuthenticated ? 'account' : 'translation');

  // Settings tour — auto-starts on first visit regardless of active tab
  const { startTour } = useSettingsTour();

  // Handle ?tour=settings query param
  const tourTriggered = useRef(false);
  useEffect(() => {
    if (searchParams.get('tour') === 'settings' && !tourTriggered.current) {
      tourTriggered.current = true;
      setSearchParams({ tab: 'translation' }, { replace: true });
      setTimeout(() => startTour(), 400);
    }
  }, [searchParams, setSearchParams, startTour]);

  useEffect(() => {
    trackEvent('settings_page_viewed', { section: activeTab });
  }, [activeTab]);

  const handleTabChange = (tab: string | null) => {
    if (tab) {
      setSearchParams({ tab }, { replace: true });
    }
  };

  return (
    <Box maw={960}>
      <MotionDiv variants={staggerPageVariants} initial="hidden" animate="visible">
        <Stack gap="lg">
          <MotionDiv variants={fadeVariants}>
            <Title order={3}>{t('Settings')}</Title>
          </MotionDiv>

          <Box style={isMobile ? undefined : { display: 'flex', gap: 'var(--mantine-spacing-xl)' }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              orientation={isMobile ? 'horizontal' : 'vertical'}
              variant="pills"
              classNames={{ tab: 'gb-tab-left-align' }}
              styles={{
                list: isMobile
                  ? { overflowX: 'auto', flexWrap: 'nowrap' }
                  : { minWidth: 200, flexShrink: 0 },
              }}
            >
              <Tabs.List data-tour="settings-tabs">
                {isAuthenticated && (
                  <Tabs.Tab value="account" leftSection={<User size={14} />}>
                    {t('Account')}
                  </Tabs.Tab>
                )}
                {isAuthenticated && (
                  <Tabs.Tab value="billing" leftSection={<CreditCard size={14} />}>
                    {t('Billing')}
                  </Tabs.Tab>
                )}
                {isAuthenticated && (
                  <Tabs.Tab value="notifications" leftSection={<Bell size={14} />}>
                    {t('Notifications')}
                  </Tabs.Tab>
                )}
                <Tabs.Tab value="translation" leftSection={<Key size={14} />}>
                  {t('Translation')}
                </Tabs.Tab>
                <Tabs.Tab value="speech" leftSection={<Volume2 size={14} />}>
                  {t('Speech')}
                </Tabs.Tab>
                <Tabs.Tab
                  value="glossary"
                  leftSection={<BookOpen size={14} />}
                  data-tour="settings-glossary-tab"
                >
                  {t('Glossary')}
                </Tabs.Tab>
                <Tabs.Tab value="shortcuts" leftSection={<Keyboard size={14} />}>
                  {t('Shortcuts')}
                </Tabs.Tab>
                <Tabs.Tab
                  value="display"
                  leftSection={<Monitor size={14} />}
                  data-tour="settings-display-tab"
                >
                  {t('Display')}
                </Tabs.Tab>
                <Tabs.Tab
                  value="backup"
                  leftSection={<Download size={14} />}
                  data-tour="settings-backup-tab"
                >
                  {t('Backup')}
                </Tabs.Tab>
                {isDevelopment && (
                  <Tabs.Tab value="development" leftSection={<GitBranch size={14} />}>
                    {t('Development')}
                  </Tabs.Tab>
                )}
              </Tabs.List>
            </Tabs>

            <Box style={{ flex: 1, minWidth: 0 }}>
              <AnimatedTabPanel tabKey={activeTab}>
                <Box pt={isMobile ? 'md' : undefined}>
                  {activeTab === 'account' && isAuthenticated && (
                    <Stack gap="md">
                      <AccountSection />
                      <DataExportSection />
                      <DeleteAccountSection />
                    </Stack>
                  )}
                  {activeTab === 'billing' && isAuthenticated && <BillingSection />}
                  {activeTab === 'notifications' && isAuthenticated && <NotificationsSection />}
                  {activeTab === 'translation' && <TranslationSection />}
                  {activeTab === 'speech' && <SpeechSection />}
                  {activeTab === 'glossary' && <GlossarySection />}
                  {activeTab === 'shortcuts' && <KeybindsSection />}
                  {activeTab === 'display' && <DisplaySection />}
                  {activeTab === 'backup' && <BackupSection />}
                  {activeTab === 'development' && isDevelopment && <DevelopmentSection />}
                </Box>
              </AnimatedTabPanel>
            </Box>
          </Box>
        </Stack>
      </MotionDiv>
    </Box>
  );
}
