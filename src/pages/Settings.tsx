/**
 * Settings — full-page app settings with tabbed navigation.
 *
 * Replaces the SettingsModal with a dedicated route at /settings.
 * Tab state persisted in the URL via ?tab= search parameter.
 */

import { useSearchParams, Link } from 'react-router';
import { Container, Stack, Title, Text, Tabs, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  User,
  Key,
  Volume2,
  BookOpen,
  Keyboard,
  Monitor,
  Download,
  GitBranch,
} from 'lucide-react';
import { sectionVariants } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { AppHeader } from '@/components/AppHeader';
import {
  AccountSection,
  TranslationSection,
  SpeechSection,
  GlossarySection,
  KeybindsSection,
  DisplaySection,
  BackupSection,
  DevelopmentSection,
} from '@/components/settings';

const MotionDiv = motion.div;

const DEFAULT_TAB = 'account';

export default function Settings() {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
  const isDevelopment = import.meta.env.DEV;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || DEFAULT_TAB;

  const handleTabChange = (tab: string | null) => {
    if (tab) {
      setSearchParams({ tab }, { replace: true });
    }
  };

  return (
    <Container size="lg" py="xl">
      <AppHeader />
      <MotionDiv variants={sectionVariants} initial="hidden" animate="visible">
        <Stack gap="lg">
          {/* Breadcrumb */}
          <Text
            component={Link}
            to="/dashboard"
            size="sm"
            style={{
              color: 'var(--gb-text-secondary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ArrowLeft size={14} />
            {t('Dashboard')}
          </Text>

          <Title order={3}>{t('Settings')}</Title>

          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            orientation={isMobile ? 'horizontal' : 'vertical'}
            variant="pills"
            classNames={{ tab: 'gb-tab-left-align' }}
            styles={{
              root: isMobile ? undefined : { display: 'flex', gap: 'var(--mantine-spacing-xl)' },
              list: isMobile
                ? { overflowX: 'auto', flexWrap: 'nowrap' }
                : { minWidth: 200, flexShrink: 0 },
              panel: { flex: 1, minWidth: 0 },
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="account" leftSection={<User size={14} />}>
                {t('Account')}
              </Tabs.Tab>
              <Tabs.Tab value="translation" leftSection={<Key size={14} />}>
                {t('Translation')}
              </Tabs.Tab>
              <Tabs.Tab value="speech" leftSection={<Volume2 size={14} />}>
                {t('Speech')}
              </Tabs.Tab>
              <Tabs.Tab value="glossary" leftSection={<BookOpen size={14} />}>
                {t('Glossary')}
              </Tabs.Tab>
              <Tabs.Tab value="shortcuts" leftSection={<Keyboard size={14} />}>
                {t('Shortcuts')}
              </Tabs.Tab>
              <Tabs.Tab value="display" leftSection={<Monitor size={14} />}>
                {t('Display')}
              </Tabs.Tab>
              <Tabs.Tab value="backup" leftSection={<Download size={14} />}>
                {t('Backup')}
              </Tabs.Tab>
              {isDevelopment && (
                <Tabs.Tab value="development" leftSection={<GitBranch size={14} />}>
                  {t('Development')}
                </Tabs.Tab>
              )}
            </Tabs.List>

            <Tabs.Panel value="account" pt={isMobile ? 'md' : undefined}>
              <AccountSection />
            </Tabs.Panel>

            <Tabs.Panel value="translation" pt={isMobile ? 'md' : undefined}>
              <TranslationSection />
            </Tabs.Panel>

            <Tabs.Panel value="speech" pt={isMobile ? 'md' : undefined}>
              <SpeechSection />
            </Tabs.Panel>

            <Tabs.Panel value="glossary" pt={isMobile ? 'md' : undefined}>
              <GlossarySection />
            </Tabs.Panel>

            <Tabs.Panel value="shortcuts" pt={isMobile ? 'md' : undefined}>
              <KeybindsSection />
            </Tabs.Panel>

            <Tabs.Panel value="display" pt={isMobile ? 'md' : undefined}>
              <DisplaySection />
            </Tabs.Panel>

            <Tabs.Panel value="backup" pt={isMobile ? 'md' : undefined}>
              <BackupSection />
            </Tabs.Panel>

            {isDevelopment && (
              <Tabs.Panel value="development" pt={isMobile ? 'md' : undefined}>
                <DevelopmentSection />
              </Tabs.Panel>
            )}
          </Tabs>
        </Stack>
      </MotionDiv>
    </Container>
  );
}
