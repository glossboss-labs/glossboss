import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/providers';
import Index from './Index';
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
});
