import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Divider,
  Group,
  Modal,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { AlertCircle, Bug, Lightbulb, MessageSquare } from 'lucide-react';
import {
  createTurnstileController,
  submitFeedbackIssue,
  type FeedbackIssueRequest,
  type FeedbackIssueSuccess,
  type FeedbackType,
  type TurnstileController,
} from '@/lib/feedback';

interface FeedbackModalProps {
  opened: boolean;
  onClose: () => void;
  currentFilename?: string | null;
  onSubmitted?: (result: FeedbackIssueSuccess) => void;
  onSubmitError?: (message: string) => void;
  submitFeedbackRequest?: (payload: FeedbackIssueRequest) => Promise<FeedbackIssueSuccess>;
  resolveTurnstileToken?: () => Promise<string>;
}

type TurnstileStatus = 'loading' | 'ready' | 'error' | 'bypass';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FeedbackModal({
  opened,
  onClose,
  currentFilename,
  onSubmitted,
  onSubmitError,
  submitFeedbackRequest = submitFeedbackIssue,
  resolveTurnstileToken,
}: FeedbackModalProps) {
  const [type, setType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');

  const [whatHappened, setWhatHappened] = useState('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');

  const [problem, setProblem] = useState('');
  const [proposedSolution, setProposedSolution] = useState('');
  const [useCase, setUseCase] = useState('');

  const [contactEmail, setContactEmail] = useState('');
  const [allowFollowUp, setAllowFollowUp] = useState(true);
  const [website, setWebsite] = useState('');

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatus>('loading');
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [turnstileContainerEl, setTurnstileContainerEl] = useState<HTMLDivElement | null>(null);

  const turnstileControllerRef = useRef<TurnstileController | null>(null);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
  const hasTurnstileSiteKey = turnstileSiteKey.length > 0;
  const bypassTurnstile =
    import.meta.env.DEV &&
    (import.meta.env.VITE_FEEDBACK_BYPASS_TURNSTILE === 'true' || !hasTurnstileSiteKey);

  const turnstileReady = useMemo(() => {
    if (resolveTurnstileToken) return true;
    if (bypassTurnstile) return true;
    return turnstileStatus === 'ready';
  }, [resolveTurnstileToken, bypassTurnstile, turnstileStatus]);

  const resetForm = useCallback(() => {
    setType('bug');
    setTitle('');
    setWhatHappened('');
    setStepsToReproduce('');
    setExpectedBehavior('');
    setProblem('');
    setProposedSolution('');
    setUseCase('');
    setContactEmail('');
    setAllowFollowUp(true);
    setWebsite('');
    setSubmitError(null);
  }, []);

  const resetTurnstileState = useCallback(() => {
    turnstileControllerRef.current?.cleanup();
    turnstileControllerRef.current = null;
    setTurnstileStatus('loading');
    setTurnstileError(null);
  }, []);

  const handleTurnstileContainerRef = useCallback((node: HTMLDivElement | null) => {
    setTurnstileContainerEl(node);
  }, []);

  useEffect(() => {
    if (!opened) {
      resetTurnstileState();
      return;
    }

    if (resolveTurnstileToken) {
      setTurnstileStatus('ready');
      setTurnstileError(null);
      return;
    }

    if (bypassTurnstile) {
      setTurnstileStatus('bypass');
      setTurnstileError(null);
      return;
    }

    if (!turnstileSiteKey) {
      setTurnstileStatus('error');
      setTurnstileError('Feedback verification is not configured.');
      return;
    }

    if (!turnstileContainerEl) {
      return;
    }

    let cancelled = false;
    setTurnstileStatus('loading');
    setTurnstileError(null);

    createTurnstileController(turnstileContainerEl, turnstileSiteKey)
      .then((controller) => {
        if (cancelled) {
          controller.cleanup();
          return;
        }
        turnstileControllerRef.current = controller;
        setTurnstileStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;
        setTurnstileStatus('error');
        setTurnstileError(
          error instanceof Error ? error.message : 'Failed to initialize verification.',
        );
      });

    return () => {
      cancelled = true;
      turnstileControllerRef.current?.cleanup();
      turnstileControllerRef.current = null;
      setTurnstileStatus('loading');
    };
  }, [
    opened,
    resolveTurnstileToken,
    bypassTurnstile,
    turnstileSiteKey,
    turnstileContainerEl,
    resetTurnstileState,
  ]);

  const resolveToken = useCallback(async (): Promise<string> => {
    if (resolveTurnstileToken) {
      return resolveTurnstileToken();
    }

    if (bypassTurnstile) {
      return 'dev-bypass';
    }

    const controller = turnstileControllerRef.current;
    if (!controller) {
      throw new Error('Verification is still loading. Please try again in a moment.');
    }

    return controller.executeChallenge();
  }, [resolveTurnstileToken, bypassTurnstile]);

  const validate = useCallback((): string | null => {
    if (!title.trim()) {
      return 'Please add a short title.';
    }

    if (contactEmail.trim() && !EMAIL_REGEX.test(contactEmail.trim())) {
      return 'Please provide a valid email address or leave it empty.';
    }

    if (type === 'bug') {
      if (!whatHappened.trim() || !stepsToReproduce.trim() || !expectedBehavior.trim()) {
        return 'Please complete all required bug fields.';
      }
      return null;
    }

    if (!problem.trim() || !proposedSolution.trim() || !useCase.trim()) {
      return 'Please complete all required feature fields.';
    }

    return null;
  }, [
    contactEmail,
    expectedBehavior,
    problem,
    proposedSolution,
    stepsToReproduce,
    title,
    type,
    useCase,
    whatHappened,
  ]);

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();

      const validationError = validate();
      if (validationError) {
        setSubmitError(validationError);
        return;
      }

      setSubmitting(true);
      setSubmitError(null);

      try {
        const turnstileToken = await resolveToken();
        const pageUrl = `${window.location.origin}${window.location.pathname}`;

        const payload: FeedbackIssueRequest = {
          type,
          title: title.trim(),
          details:
            type === 'bug'
              ? {
                  whatHappened: whatHappened.trim(),
                  stepsToReproduce: stepsToReproduce.trim(),
                  expectedBehavior: expectedBehavior.trim(),
                }
              : {
                  problem: problem.trim(),
                  proposedSolution: proposedSolution.trim(),
                  useCase: useCase.trim(),
                },
          contactEmail: contactEmail.trim() || undefined,
          allowFollowUp,
          context: {
            appVersion: __APP_VERSION__,
            pageUrl,
            filename: currentFilename || undefined,
            userAgent: navigator.userAgent,
            submittedAt: new Date().toISOString(),
          },
          turnstileToken,
          website,
        };

        const result = await submitFeedbackRequest(payload);
        onSubmitted?.(result);
        resetForm();
        onClose();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Feedback could not be submitted at this time.';
        setSubmitError(message);
        onSubmitError?.(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      allowFollowUp,
      contactEmail,
      currentFilename,
      expectedBehavior,
      onClose,
      onSubmitError,
      onSubmitted,
      problem,
      proposedSolution,
      resetForm,
      resolveToken,
      stepsToReproduce,
      submitFeedbackRequest,
      title,
      type,
      useCase,
      validate,
      website,
      whatHappened,
    ],
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <MessageSquare size={18} />
          <Text fw={600}>Share Feedback</Text>
        </Group>
      }
      centered
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Tabs value={type} onChange={(value) => setType((value as FeedbackType) || 'bug')}>
            <Tabs.List>
              <Tabs.Tab value="bug" leftSection={<Bug size={14} />}>
                Bug
              </Tabs.Tab>
              <Tabs.Tab value="feature" leftSection={<Lightbulb size={14} />}>
                Feature
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="bug" pt="md">
              <Stack gap="sm">
                <TextInput
                  label="Title"
                  placeholder="Short summary of the issue"
                  value={title}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                />
                <Textarea
                  label="What happened"
                  placeholder="Describe what you saw"
                  value={whatHappened}
                  onChange={(event) => setWhatHappened(event.currentTarget.value)}
                  autosize
                  minRows={3}
                />
                <Textarea
                  label="Steps to reproduce"
                  placeholder="List steps someone else can follow"
                  value={stepsToReproduce}
                  onChange={(event) => setStepsToReproduce(event.currentTarget.value)}
                  autosize
                  minRows={3}
                />
                <Textarea
                  label="Expected behavior"
                  placeholder="What should have happened"
                  value={expectedBehavior}
                  onChange={(event) => setExpectedBehavior(event.currentTarget.value)}
                  autosize
                  minRows={2}
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="feature" pt="md">
              <Stack gap="sm">
                <TextInput
                  label="Title"
                  placeholder="Short summary of the request"
                  value={title}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                />
                <Textarea
                  label="Problem / opportunity"
                  placeholder="What is hard today?"
                  value={problem}
                  onChange={(event) => setProblem(event.currentTarget.value)}
                  autosize
                  minRows={3}
                />
                <Textarea
                  label="Proposed solution"
                  placeholder="What would help?"
                  value={proposedSolution}
                  onChange={(event) => setProposedSolution(event.currentTarget.value)}
                  autosize
                  minRows={3}
                />
                <Textarea
                  label="Use case"
                  placeholder="When would you use this?"
                  value={useCase}
                  onChange={(event) => setUseCase(event.currentTarget.value)}
                  autosize
                  minRows={2}
                />
              </Stack>
            </Tabs.Panel>
          </Tabs>

          <Divider label="Contact (optional)" labelPosition="left" />

          <Alert color="gray" icon={<AlertCircle size={16} />}>
            <Text size="sm">
              Submissions may create a GitHub issue and can include your optional contact email for
              follow-up. See{' '}
              <Text component="a" href="/privacy/" inherit td="underline">
                Privacy
              </Text>{' '}
              for details.
            </Text>
          </Alert>

          <TextInput
            label="Email"
            placeholder="name@example.com"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.currentTarget.value)}
          />

          <Switch
            label="Allow follow-up questions about this feedback"
            checked={allowFollowUp}
            onChange={(event) => setAllowFollowUp(event.currentTarget.checked)}
          />

          <TextInput
            label="Website"
            value={website}
            onChange={(event) => setWebsite(event.currentTarget.value)}
            tabIndex={-1}
            autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            aria-hidden="true"
          />

          <div
            ref={handleTurnstileContainerRef}
            className="feedback-turnstile-mount"
            data-testid="feedback-turnstile-mount"
          />

          {turnstileStatus === 'loading' && !resolveTurnstileToken && (
            <Text size="xs" c="dimmed">
              Preparing spam protection...
            </Text>
          )}

          {bypassTurnstile && (
            <Text size="xs" c="yellow">
              {hasTurnstileSiteKey
                ? 'Turnstile bypass enabled for local development.'
                : 'Turnstile site key not set. Using local development bypass.'}
            </Text>
          )}

          {turnstileError && (
            <Alert color="red" icon={<AlertCircle size={16} />}>
              {turnstileError}
            </Alert>
          )}

          {submitError && (
            <Alert color="red" icon={<AlertCircle size={16} />}>
              {submitError}
            </Alert>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={!turnstileReady}>
              Send feedback
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
