import { useCallback, useState } from 'react';
import type { FeedbackIssueSuccess } from '@/lib/feedback';
import { useRepoSyncStore } from '@/stores';
import type { FeedbackInfo } from './types';

export function useEditorDialogs() {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [qaSummaryOpen, setQaSummaryOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<FeedbackInfo | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [urlPromptOpen, setUrlPromptOpen] = useState(false);
  const [wordpressProjectOpen, setWordpressProjectOpen] = useState(false);
  const [wordpressRefreshOpen, setWordpressRefreshOpen] = useState(false);
  const [repoSyncOpen, setRepoSyncOpen] = useState(false);
  const [saveToCloudOpen, setSaveToCloudOpen] = useState(false);
  const [repoSyncInitialTab, setRepoSyncInitialTab] = useState<
    'connect' | 'browse' | 'push' | undefined
  >(undefined);

  const repoConnection = useRepoSyncStore((state) => state.connection);

  const openUrlPrompt = useCallback(() => {
    setUrlPromptOpen(true);
  }, []);

  const closeUrlPrompt = useCallback(() => {
    setUrlPromptOpen(false);
  }, []);

  const openWordPressProjectModal = useCallback(() => {
    setWordpressProjectOpen(true);
  }, []);

  const closeWordPressProjectModal = useCallback(() => {
    setWordpressProjectOpen(false);
  }, []);

  const openWordPressRefreshModal = useCallback(() => {
    setWordpressRefreshOpen(true);
  }, []);

  const closeWordPressRefreshModal = useCallback(() => {
    setWordpressRefreshOpen(false);
  }, []);

  const openRepoSyncPush = useCallback(() => {
    setRepoSyncInitialTab('push');
    setRepoSyncOpen(true);
  }, []);

  const openRepoSyncConnect = useCallback(() => {
    setRepoSyncInitialTab('connect');
    setRepoSyncOpen(true);
  }, []);

  const openRepoSyncConnectOrPush = useCallback(() => {
    setRepoSyncInitialTab(repoConnection ? 'push' : 'connect');
    setRepoSyncOpen(true);
  }, [repoConnection]);

  const closeRepoSync = useCallback(() => {
    setRepoSyncOpen(false);
    setRepoSyncInitialTab(undefined);
  }, []);

  const closeQaSummary = useCallback(() => {
    setQaSummaryOpen(false);
  }, []);

  const handleFeedbackSubmitted = useCallback((result: FeedbackIssueSuccess) => {
    setFeedbackSuccess({ issueNumber: result.issueNumber, issueUrl: result.issueUrl });
    setFeedbackError(null);
    window.setTimeout(() => setFeedbackSuccess(null), 5000);
  }, []);

  const handleFeedbackSubmitError = useCallback((message: string) => {
    setFeedbackError(message);
    window.setTimeout(() => setFeedbackError(null), 6000);
  }, []);

  return {
    confirmClearOpen,
    setConfirmClearOpen,
    qaSummaryOpen,
    setQaSummaryOpen,
    feedbackOpen,
    setFeedbackOpen,
    feedbackSuccess,
    setFeedbackSuccess,
    feedbackError,
    setFeedbackError,
    urlPromptOpen,
    openUrlPrompt,
    closeUrlPrompt,
    wordpressProjectOpen,
    openWordPressProjectModal,
    closeWordPressProjectModal,
    wordpressRefreshOpen,
    openWordPressRefreshModal,
    closeWordPressRefreshModal,
    repoSyncOpen,
    repoSyncInitialTab,
    openRepoSyncPush,
    openRepoSyncConnect,
    openRepoSyncConnectOrPush,
    closeRepoSync,
    saveToCloudOpen,
    setSaveToCloudOpen,
    closeQaSummary,
    handleFeedbackSubmitted,
    handleFeedbackSubmitError,
    repoConnection,
  };
}
