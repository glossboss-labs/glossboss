/**
 * EmptyState — landing view when no file is loaded.
 *
 * Shows drag-and-drop prompt, URL input, and quick-open buttons
 * for WordPress.org, repository sync, and the bundled example.
 */

import type { KeyboardEvent } from 'react';
import {
  Stack,
  Title,
  Text,
  Group,
  Badge,
  Button,
  TextInput,
  Tooltip,
  Paper,
  rem,
} from '@mantine/core';
import { Link as RouterLink } from 'react-router';
import { motion } from 'motion/react';
import { FileUp, Globe, GitBranch, Link, Cloud } from 'lucide-react';
import { sectionVariants, buttonStates } from '@/lib/motion';
import { useTranslation } from '@/lib/app-language';
import { useAuth } from '@/hooks/use-auth';

const MotionDiv = motion.div;
const appIcon = '/icon.svg'; // glossboss-icon-dark-bg

export interface EmptyStateProps {
  onFileClick: () => void;
  urlInput: string;
  onUrlInputChange: (value: string) => void;
  isLoadingUrl: boolean;
  onLoadFromUrl: (url: string) => void;
  onOpenWordPressProject: () => void;
  onOpenRepoSync: () => void;
  isLoadingExample: boolean;
  onLoadExamplePo: () => void;
}

export function EmptyState({
  onFileClick,
  urlInput,
  onUrlInputChange,
  isLoadingUrl,
  onLoadFromUrl,
  onOpenWordPressProject,
  onOpenRepoSync,
  isLoadingExample,
  onLoadExamplePo,
}: EmptyStateProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <MotionDiv
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      onClick={onFileClick}
      style={{ cursor: 'pointer' }}
    >
      <Paper
        p={{ base: rem(24), sm: rem(80) }}
        withBorder
        style={{
          borderStyle: 'dashed',
          borderWidth: 2,
          borderColor: 'var(--mantine-color-default-border)',
        }}
      >
        <Stack align="center" gap="lg">
          <img
            data-ev-id="ev_1ff14ea799"
            src={appIcon}
            alt="GlossBoss"
            style={{
              width: 64,
              height: 64,
            }}
          />

          <Stack align="center" gap="xs">
            <Title order={2}>{t('Upload a translation file to start')}</Title>
            <Text ta="center" maw={400} style={{ color: 'var(--gb-text-secondary)' }}>
              {t(
                'Drag and drop a .po, .pot, or .json file — or click to browse. Always free, no account needed.',
              )}
            </Text>
          </Stack>
          <Group gap="xs">
            <Badge variant="light" color="blue">
              .po
            </Badge>
            <Badge variant="light" color="blue">
              .pot
            </Badge>
            <Badge variant="light" color="blue">
              .json
            </Badge>
          </Group>
          <Group gap="xs" w="100%" maw={500} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <TextInput
              placeholder={t('Paste a .po file URL')}
              aria-label={t('PO file URL')}
              value={urlInput}
              onChange={(e) => onUrlInputChange(e.currentTarget.value)}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter' && urlInput.trim() && !isLoadingUrl) {
                  void onLoadFromUrl(urlInput.trim());
                }
              }}
              style={{ flex: 1 }}
              leftSection={<Link size={16} />}
              disabled={isLoadingUrl}
            />
            <Button
              onClick={() => void onLoadFromUrl(urlInput.trim())}
              loading={isLoadingUrl}
              disabled={!urlInput.trim() || isLoadingUrl}
            >
              {t('Load')}
            </Button>
          </Group>

          <Text size="sm" style={{ color: 'var(--gb-text-secondary)' }}>
            {t('or')}
          </Text>

          <Group
            gap="sm"
            wrap="wrap"
            justify="center"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <Tooltip label={t('Open the latest WordPress.org translation export by project slug')}>
              <motion.div {...buttonStates}>
                <Button
                  variant="default"
                  leftSection={<Globe size={16} />}
                  onClick={onOpenWordPressProject}
                >
                  {t('Open from WordPress.org')}
                </Button>
              </motion.div>
            </Tooltip>

            <Tooltip label={t('Open a locale file from a GitHub or GitLab repository')}>
              <motion.div {...buttonStates}>
                <Button
                  variant="default"
                  leftSection={<GitBranch size={16} />}
                  onClick={onOpenRepoSync}
                >
                  {t('Open from repository')}
                </Button>
              </motion.div>
            </Tooltip>

            <Tooltip label={t('Load a small example WordPress plugin PO file (Hello Dolly)')}>
              <motion.div {...buttonStates}>
                <Button
                  variant="default"
                  leftSection={<FileUp size={16} />}
                  loading={isLoadingExample}
                  onClick={() => {
                    void onLoadExamplePo();
                  }}
                >
                  {t('Load example PO')}
                </Button>
              </motion.div>
            </Tooltip>
          </Group>

          {!isAuthenticated && (
            <Group
              gap={4}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              style={{ cursor: 'default' }}
            >
              <Cloud size={14} style={{ opacity: 0.4 }} />
              <Text size="xs" c="dimmed">
                <RouterLink
                  to="/login"
                  style={{
                    color: 'var(--mantine-color-blue-6)',
                    textDecoration: 'none',
                  }}
                >
                  {t('Sign in')}
                </RouterLink>{' '}
                {t(
                  "to save projects to the cloud and collaborate with your team. Collaborators work under the project owner's plan — no subscription needed to contribute.",
                )}
              </Text>
            </Group>
          )}
        </Stack>
      </Paper>
    </MotionDiv>
  );
}
