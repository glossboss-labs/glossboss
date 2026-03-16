/**
 * GlossBoss - Main Page
 *
 * Thin page wrapper that composes the editor shell around the extracted
 * controller hook and page-specific subcomponents.
 */

import { Box, Container, Stack } from '@mantine/core';
import { EmptyState, EditorHeader, EditorWorkspace } from '@/components/editor';
import { IndexPageBanners } from './index/IndexPageBanners';
import { IndexPageDialogs } from './index/IndexPageDialogs';
import { IndexPageNotifications } from './index/IndexPageNotifications';
import { useIndexPageController } from './index/useIndexPageController';

export default function Index() {
  const {
    containerWidth,
    dragAreaProps,
    headerProps,
    workspaceProps,
    emptyStateProps,
    notificationsProps,
    bannersProps,
    dialogsProps,
  } = useIndexPageController();

  return (
    <Box {...dragAreaProps} style={{ minHeight: '100vh', position: 'relative' }}>
      <IndexPageNotifications {...notificationsProps} />

      <Box component="main">
        <Container
          size={containerWidth === '100%' ? undefined : containerWidth}
          fluid={containerWidth === '100%'}
          py="xl"
        >
          <Stack gap="lg">
            <EditorHeader {...headerProps} />
            <IndexPageBanners {...bannersProps} />
            {workspaceProps ? (
              <EditorWorkspace {...workspaceProps} />
            ) : (
              <EmptyState {...emptyStateProps} />
            )}
          </Stack>
        </Container>
      </Box>

      <IndexPageDialogs {...dialogsProps} />
    </Box>
  );
}
