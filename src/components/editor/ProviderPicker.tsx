/**
 * Provider Picker — language selection dropdowns plus inline provider context.
 */

import { useState, type ReactNode } from 'react';
import {
  Group,
  Select,
  Text,
  Badge,
  Alert,
  Button,
  Stack,
  useMantineTheme,
  Menu,
  UnstyledButton,
  Divider,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { motion, AnimatePresence } from 'motion/react';
import { WandSparkles, Key, ChevronDown, Check, SlidersHorizontal } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from '@/lib/app-language';
import { contentVariants, dropdownTransitionProps, fadeVariants } from '@/lib/motion';
import { renderFlagOption, SettingsSourceBadge, type SettingsSource } from '@/components/ui';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from './translate-languages';
import type { TranslationProviderId } from '@/lib/translation/types';
import { getTranslationProviderLabel } from '@/lib/translation';
import { buildTranslationSettingsHref } from '@/lib/settings/navigation';

const MotionDiv = motion.div;

export interface ProviderPickerProps {
  sourceLang: string;
  targetLang: string;
  inferredTarget: string | null;
  provider: TranslationProviderId;
  providerLabel: string;
  providerSource: SettingsSource;
  providerLocked: boolean;
  configuredProviders: TranslationProviderId[];
  hasApiKey: boolean;
  selectedCount: number;
  untranslatedCount: number;
  onSourceChange: (value: string | null) => void;
  onTargetChange: (value: string | null) => void;
  onProviderChange: (provider: TranslationProviderId) => void;
  /** Slot for action buttons (translate / cancel) rendered beside the language selectors */
  actionSlot?: ReactNode;
}

export function ProviderPicker({
  sourceLang,
  targetLang,
  inferredTarget,
  provider,
  providerLabel,
  providerSource,
  providerLocked,
  configuredProviders,
  hasApiKey,
  selectedCount,
  untranslatedCount,
  onSourceChange,
  onTargetChange,
  onProviderChange,
  actionSlot,
}: ProviderPickerProps) {
  const { t } = useTranslation();
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpened, setMenuOpened] = useState(false);
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  const settingsHref = buildTranslationSettingsHref({ provider, returnTo });
  const canSwitchInline =
    providerSource === 'personal' && configuredProviders.some((item) => item !== provider);

  return (
    <>
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="xs" align="center">
          <WandSparkles size={14} />
          <Text size="sm" fw={600}>
            {t('Machine translation')}
          </Text>

          <Menu
            shadow="md"
            width={280}
            position="bottom-start"
            transitionProps={dropdownTransitionProps}
            opened={menuOpened}
            onChange={setMenuOpened}
          >
            <Menu.Target>
              <UnstyledButton
                aria-label={t('Change translation provider')}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <AnimatePresence initial={false} mode="wait">
                  <MotionDiv
                    key={`${provider}-${providerSource}`}
                    variants={fadeVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                  >
                    <Group gap={6} wrap="nowrap">
                      <Badge size="xs" variant="light" color="gray">
                        {providerLabel}
                      </Badge>
                      <SettingsSourceBadge source={providerSource} />
                      <ChevronDown
                        size={12}
                        color="var(--mantine-color-gray-6)"
                        style={{
                          transform: menuOpened ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      />
                    </Group>
                  </MotionDiv>
                </AnimatePresence>
              </UnstyledButton>
            </Menu.Target>

            <Menu.Dropdown>
              <Stack gap="xs" p="xs">
                <Stack gap={4}>
                  <Text size="xs" fw={600}>
                    {t('Active provider')}
                  </Text>
                  <Group gap={6}>
                    <Badge size="sm" variant="light" color="gray">
                      {providerLabel}
                    </Badge>
                    <SettingsSourceBadge source={providerSource} />
                  </Group>
                  <Text size="xs" c="dimmed">
                    {providerLocked
                      ? t('This provider is locked by your organization.')
                      : providerSource === 'project'
                        ? t('This language uses a project-level override.')
                        : providerSource === 'org-default'
                          ? t('This project inherits your organization default.')
                          : t('This editor uses your personal default provider.')}
                  </Text>
                </Stack>

                <Divider />

                {canSwitchInline ? (
                  <Stack gap={4}>
                    <Text size="xs" fw={600}>
                      {t('Switch here')}
                    </Text>
                    {configuredProviders.map((configuredProvider) => {
                      const isActive = configuredProvider === provider;
                      return (
                        <Button
                          key={configuredProvider}
                          variant={isActive ? 'light' : 'subtle'}
                          fullWidth
                          size="xs"
                          color={isActive ? 'blue' : 'gray'}
                          rightSection={
                            isActive ? <Check size={12} /> : <SlidersHorizontal size={12} />
                          }
                          onClick={() => onProviderChange(configuredProvider)}
                        >
                          {getTranslationProviderLabel(configuredProvider)}
                        </Button>
                      );
                    })}
                  </Stack>
                ) : (
                  <Text size="xs" c="dimmed">
                    {providerSource === 'personal'
                      ? t('Connect another provider in Settings to switch here.')
                      : t('Change this provider from project or organization settings.')}
                  </Text>
                )}

                <Button
                  size="xs"
                  variant="light"
                  leftSection={<Key size={12} />}
                  onClick={() => navigate(settingsHref)}
                >
                  {t('Manage provider setup')}
                </Button>
              </Stack>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Text size="xs" c="dimmed">
          {selectedCount > 0
            ? t('{{count}} selected', { count: selectedCount })
            : t('{{count}} untranslated', { count: untranslatedCount })}
        </Text>
      </Group>

      <AnimatePresence>
        {!hasApiKey && (
          <MotionDiv variants={contentVariants} initial="hidden" animate="visible" exit="exit">
            <Alert color="yellow" icon={<Key size={16} />}>
              <Group justify="space-between" align="center" wrap="wrap" gap="xs">
                <Text size="sm">
                  {t('{{provider}} needs an API key before translation can start.', {
                    provider: providerLabel,
                  })}
                </Text>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<Key size={14} />}
                  onClick={() => navigate(settingsHref)}
                >
                  {t('Set up {{provider}}', { provider: providerLabel })}
                </Button>
              </Group>
            </Alert>
          </MotionDiv>
        )}
      </AnimatePresence>

      <Group
        data-tour="language-selectors"
        justify="space-between"
        align={isMobile ? 'stretch' : 'center'}
        wrap="wrap"
        style={isMobile ? { flexDirection: 'column' } : undefined}
      >
        {isMobile ? (
          <Stack gap="xs" w="100%">
            <Group gap="xs" align="center" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={500}>
                {t('From')}
              </Text>
              <Select
                data={SOURCE_LANGUAGES.map((opt) => ({
                  ...opt,
                  label: t(opt.label),
                }))}
                value={sourceLang}
                onChange={onSourceChange}
                placeholder={t('Auto-detect')}
                searchable
                clearable
                size="xs"
                disabled={!hasApiKey}
                aria-label={t('Source language')}
                style={{ flex: 1, minWidth: 0 }}
                renderOption={renderFlagOption}
              />
            </Group>
            <Group gap="xs" align="center" wrap="nowrap">
              <Text size="xs" c="dimmed" fw={500}>
                {t('To')}
              </Text>
              <Select
                data={TARGET_LANGUAGES.map((opt) => ({
                  ...opt,
                  label: t(opt.label),
                }))}
                value={targetLang}
                onChange={onTargetChange}
                placeholder={t('Select target...')}
                searchable
                required
                size="xs"
                disabled={!hasApiKey}
                aria-label={t('Target language')}
                style={{ flex: 1, minWidth: 0 }}
                renderOption={renderFlagOption}
              />
              {inferredTarget && (
                <Badge size="xs" variant="light" color="gray" style={{ flexShrink: 0 }}>
                  {t('Detected: {{target}}', { target: inferredTarget })}
                </Badge>
              )}
            </Group>
          </Stack>
        ) : (
          <Group gap="xs" align="center">
            <Text size="xs" c="dimmed" fw={500}>
              {t('From')}
            </Text>
            <Select
              data={SOURCE_LANGUAGES.map((opt) => ({
                ...opt,
                label: t(opt.label),
              }))}
              value={sourceLang}
              onChange={onSourceChange}
              placeholder={t('Auto-detect')}
              searchable
              clearable
              w={160}
              size="xs"
              disabled={!hasApiKey}
              aria-label={t('Source language')}
              renderOption={renderFlagOption}
            />

            <Text c="dimmed" size="sm" aria-hidden="true">
              {'\u2192'}
            </Text>

            <Text size="xs" c="dimmed" fw={500}>
              {t('To')}
            </Text>
            <Select
              data={TARGET_LANGUAGES.map((opt) => ({
                ...opt,
                label: t(opt.label),
              }))}
              value={targetLang}
              onChange={onTargetChange}
              placeholder={t('Select target...')}
              searchable
              required
              w={170}
              size="xs"
              disabled={!hasApiKey}
              aria-label={t('Target language')}
              renderOption={renderFlagOption}
            />

            {inferredTarget && (
              <Badge size="xs" variant="light" color="gray">
                {t('Detected: {{target}}', { target: inferredTarget })}
              </Badge>
            )}
          </Group>
        )}

        {actionSlot}
      </Group>
    </>
  );
}
