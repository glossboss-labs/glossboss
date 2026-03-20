/**
 * GlossBoss - Main Page
 *
 * Thin page wrapper that composes the editor shell around the extracted
 * controller hook and page-specific subcomponents.
 */

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { Box, Container, Stack } from '@mantine/core';
import { msgid } from '@/lib/app-language';
import { EmptyState, EditorHeader, EditorWorkspace } from '@/components/editor';
import { SeoMeta } from '@/components/SeoMeta';
import { IndexPageBanners } from './index/IndexPageBanners';
import { IndexPageDialogs } from './index/IndexPageDialogs';
import { IndexPageNotifications } from './index/IndexPageNotifications';
import { useIndexPageController } from './index/useIndexPageController';
import { useEditorTour } from '@/hooks/use-editor-tour';

const META_TITLE = 'Free Online PO Editor for PO, POT and JSON — GlossBoss';
const BROWSER_TITLE = msgid('Editor — GlossBoss');
const META_DESCRIPTION =
  'Open PO, POT, and i18next JSON files in your browser and translate them with the free local editor. No account required.';

export default function Index() {
  const [searchParams, setSearchParams] = useSearchParams();
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

  const { startTour } = useEditorTour({ hasFile: !!workspaceProps });

  // Handle ?tour=1 query param (from UserMenu "Take a tour" link)
  const tourTriggered = useRef(false);
  useEffect(() => {
    if (searchParams.get('tour') === '1' && !tourTriggered.current) {
      tourTriggered.current = true;
      setSearchParams({}, { replace: true });
      // Small delay to let the page settle
      setTimeout(() => startTour(), 400);
    }
  }, [searchParams, setSearchParams, startTour]);

  return (
    <Box {...dragAreaProps} style={{ minHeight: '100vh', position: 'relative' }}>
      <SeoMeta
        title={META_TITLE}
        browserTitle={BROWSER_TITLE}
        description={META_DESCRIPTION}
        canonicalPath="/editor"
      />
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
              <EmptyState {...emptyStateProps} onStartTour={startTour} />
            )}
          </Stack>
        </Container>
      </Box>

      <IndexPageDialogs {...dialogsProps} />
    </Box>
  );
}
