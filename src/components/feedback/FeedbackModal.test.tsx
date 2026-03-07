import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import type { ComponentProps } from 'react';
import { FeedbackModal } from './FeedbackModal';
import type { FeedbackIssueRequest, FeedbackIssueSuccess } from '@/lib/feedback';

function renderModal(props: Partial<ComponentProps<typeof FeedbackModal>> = {}) {
  const onClose = props.onClose ?? vi.fn();

  return {
    onClose,
    ...render(
      <MantineProvider>
        <FeedbackModal
          opened
          onClose={onClose}
          resolveTurnstileToken={props.resolveTurnstileToken ?? (async () => 'turnstile-token')}
          submitFeedbackRequest={
            props.submitFeedbackRequest ?? (async () => ({ ok: true, issueNumber: 123 }))
          }
          {...props}
        />
      </MantineProvider>,
    ),
  };
}

describe('FeedbackModal', () => {
  it('blocks submit when required bug fields are missing', async () => {
    const user = userEvent.setup();
    const submitMock = vi.fn<(payload: FeedbackIssueRequest) => Promise<FeedbackIssueSuccess>>();

    renderModal({ submitFeedbackRequest: submitMock });

    await user.type(screen.getByPlaceholderText('Short summary of the issue'), 'Crash on save');
    await user.click(screen.getByRole('button', { name: /send feedback/i }));

    expect(screen.getByText('Please complete all required bug fields.')).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it('blocks submit when required feature fields are missing', async () => {
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
  });

  it('submits valid feedback and closes with a reset form', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const submitMock = vi
      .fn<(payload: FeedbackIssueRequest) => Promise<FeedbackIssueSuccess>>()
      .mockResolvedValue({
        ok: true,
        issueNumber: 55,
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
        }),
      }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText('Short summary of the issue')).toHaveValue('');
  });

  it('shows submission errors from backend', async () => {
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
  });
});
