import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { ComponentProps } from 'react';
import { FeedbackModal } from './FeedbackModal';
import type { FeedbackIssueRequest, FeedbackIssueSuccess } from '@/lib/feedback';

function renderModal(props: Partial<ComponentProps<typeof FeedbackModal>> = {}) {
  const { onClose = vi.fn(), ...restProps } = props;
  const defaultProps: ComponentProps<typeof FeedbackModal> = {
    opened: true,
    onClose,
    resolveTurnstileToken: async () => 'turnstile-token',
    submitFeedbackRequest: async () => ({
      ok: true,
      referenceId: 'INBOX-123',
    }),
  };

  return {
    onClose,
    ...render(
      <MantineProvider>
        <FeedbackModal {...defaultProps} {...restProps} />
      </MantineProvider>,
    ),
  };
}

const testEnv = import.meta.env as Record<string, string | undefined>;
const originalTurnstileSiteKey = testEnv.VITE_TURNSTILE_SITE_KEY;
const originalFeedbackBypass = testEnv.VITE_FEEDBACK_BYPASS_TURNSTILE;
const SLOW_UI_TEST_TIMEOUT = 30_000;

describe('FeedbackModal', () => {
  afterEach(() => {
    testEnv.VITE_TURNSTILE_SITE_KEY = originalTurnstileSiteKey;
    testEnv.VITE_FEEDBACK_BYPASS_TURNSTILE = originalFeedbackBypass;
  }, SLOW_UI_TEST_TIMEOUT);

  it('blocks submit when required bug fields are missing', async () => {
    const user = userEvent.setup();
    const submitMock = vi.fn<(payload: FeedbackIssueRequest) => Promise<FeedbackIssueSuccess>>();

    renderModal({ submitFeedbackRequest: submitMock });

    await user.type(screen.getByPlaceholderText('Short summary of the issue'), 'Crash on save');
    await user.click(screen.getByRole('button', { name: /send feedback/i }));

    expect(screen.getByText('Please complete all required bug fields.')).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  }, 10000);

  it(
    'blocks submit when required feature fields are missing',
    async () => {
      const user = userEvent.setup();
      const submitMock = vi.fn<(payload: FeedbackIssueRequest) => Promise<FeedbackIssueSuccess>>();

      renderModal({ submitFeedbackRequest: submitMock });

      await user.click(screen.getByRole('tab', { name: /^feature$/i }));
      await user.type(
        screen.getByPlaceholderText('Short summary of the request'),
        'Add search filters',
      );
      await user.click(screen.getByRole('button', { name: /send feedback/i }));

      expect(screen.getByText('Please complete all required feature fields.')).toBeInTheDocument();
      expect(submitMock).not.toHaveBeenCalled();
    },
    SLOW_UI_TEST_TIMEOUT,
  );

  it(
    'submits valid feedback and closes with a reset form',
    async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      window.history.pushState({}, '', '/editor?token=secret#fragment');
      const submitMock = vi
        .fn<(payload: FeedbackIssueRequest) => Promise<FeedbackIssueSuccess>>()
        .mockResolvedValue({
          ok: true,
          referenceId: 'INBOX-55',
        });

      renderModal({
        onClose,
        currentFilename: 'nl.po',
        submitFeedbackRequest: submitMock,
      });

      await user.type(screen.getByPlaceholderText('Short summary of the issue'), 'Crash on save');
      await user.type(
        screen.getByPlaceholderText('Describe what you saw'),
        'App closes unexpectedly',
      );
      await user.type(
        screen.getByPlaceholderText('List steps someone else can follow'),
        '1. Open file\n2. Save',
      );
      await user.type(
        screen.getByPlaceholderText('What should have happened'),
        'The file should save successfully',
      );
      await user.click(screen.getByRole('button', { name: /send feedback/i }));

      await waitFor(() => {
        expect(submitMock).toHaveBeenCalledTimes(1);
      });

      expect(submitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'bug',
          title: 'Crash on save',
          turnstileToken: 'turnstile-token',
          website: '',
          context: expect.objectContaining({
            appVersion: 'test-version',
            filename: 'nl.po',
            pageUrl: 'http://localhost:3000/editor',
          }),
        }),
      );

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByPlaceholderText('Short summary of the issue')).toHaveValue('');
      window.history.pushState({}, '', '/');
    },
    SLOW_UI_TEST_TIMEOUT,
  );

  it(
    'shows submission errors from backend',
    async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const submitMock = vi
        .fn<(payload: FeedbackIssueRequest) => Promise<FeedbackIssueSuccess>>()
        .mockRejectedValue(new Error('Too many requests'));

      renderModal({ onClose, submitFeedbackRequest: submitMock });

      await user.type(screen.getByPlaceholderText('Short summary of the issue'), 'Crash on save');
      await user.type(
        screen.getByPlaceholderText('Describe what you saw'),
        'App closes unexpectedly',
      );
      await user.type(
        screen.getByPlaceholderText('List steps someone else can follow'),
        '1. Open file\n2. Save',
      );
      await user.type(
        screen.getByPlaceholderText('What should have happened'),
        'The file should save successfully',
      );

      await user.click(screen.getByRole('button', { name: /send feedback/i }));

      expect(await screen.findByText('Too many requests')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    },
    SLOW_UI_TEST_TIMEOUT,
  );

  it('auto-enables local bypass when site key is missing in dev', async () => {
    testEnv.VITE_TURNSTILE_SITE_KEY = '';
    testEnv.VITE_FEEDBACK_BYPASS_TURNSTILE = 'false';

    renderModal({ resolveTurnstileToken: undefined });

    expect(
      await screen.findByText('Turnstile site key not set. Using local development bypass.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send feedback/i })).toBeEnabled();
  });

  it('shows standard bypass message when bypass flag is explicitly enabled', async () => {
    testEnv.VITE_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    testEnv.VITE_FEEDBACK_BYPASS_TURNSTILE = 'true';

    renderModal({ resolveTurnstileToken: undefined });

    expect(
      await screen.findByText('Turnstile bypass enabled for local development.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send feedback/i })).toBeEnabled();
  });

  it('renders the Turnstile mount with the spacing-fix class', () => {
    renderModal();

    expect(screen.getByTestId('feedback-turnstile-mount')).toHaveClass('feedback-turnstile-mount');
  });
});
