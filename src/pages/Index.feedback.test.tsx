import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/providers';
import Index from '@/pages/Index';
import { useEditorStore } from '@/stores/editor-store';
import { useSourceStore } from '@/stores/source-store';

describe('Index feedback header action', () => {
  beforeEach(() => {
    localStorage.clear();
    useEditorStore.getState().clearEditor();
    useSourceStore.getState().clearSource();
  });

  it('renders a feedback button and opens feedback modal', async () => {
    const user = userEvent.setup();

    render(
      <AppProviders>
        <Index />
      </AppProviders>,
    );

    const feedbackButton = screen.getByRole('button', { name: /feedback/i });
    expect(feedbackButton).toBeInTheDocument();

    await user.click(feedbackButton);

    expect(await screen.findByText('Share Feedback')).toBeInTheDocument();
  });

  it('shows the development branch chip by default and hides it when disabled in storage', () => {
    const { unmount } = render(
      <AppProviders>
        <Index />
      </AppProviders>,
    );

    expect(screen.getByText('test-branch')).toBeInTheDocument();

    unmount();

    localStorage.setItem('glossboss-dev-branch-chip-enabled', 'false');

    render(
      <AppProviders>
        <Index />
      </AppProviders>,
    );

    expect(screen.queryByText('test-branch')).not.toBeInTheDocument();
  });

  it('hides the development branch chip when the cursor gets close and restores it on leave', async () => {
    render(
      <AppProviders>
        <Index />
      </AppProviders>,
    );

    const branchLabel = screen.getByText('test-branch');
    const chip = branchLabel.closest('div[style*="position: fixed"]');

    expect(chip).toBeTruthy();
    expect(chip).toHaveStyle({ pointerEvents: 'auto' });

    fireEvent.mouseMove(window, {
      clientX: window.innerWidth - 16,
      clientY: window.innerHeight - 16,
    });

    await waitFor(() => {
      expect(chip).toHaveStyle({ pointerEvents: 'none' });
    });

    fireEvent.mouseLeave(window);

    await waitFor(() => {
      expect(chip).toHaveStyle({ pointerEvents: 'auto' });
    });
  });
});
