import type { FeedbackIssueRequest, FeedbackIssueResponse, FeedbackIssueSuccess } from './types';
import { buildSupabaseFunctionHeaders } from '@/lib/supabase-function-headers';

const REQUEST_TIMEOUT_MS = 20000;

export class FeedbackSubmissionError extends Error {
  code: string;

  constructor(message: string, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'FeedbackSubmissionError';
    this.code = code;
  }
}

function getFeedbackFunctionUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new FeedbackSubmissionError(
      'Cloud backend is not configured. Add VITE_SUPABASE_URL to enable feedback.',
      'MISSING_SUPABASE_URL',
    );
  }
  return `${supabaseUrl}/functions/v1/feedback-issue`;
}

export async function submitFeedbackIssue(
  payload: FeedbackIssueRequest,
): Promise<FeedbackIssueSuccess> {
  const functionUrl = getFeedbackFunctionUrl();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const headers = buildSupabaseFunctionHeaders(anonKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => null)) as FeedbackIssueResponse | null;
    const errorBody = data && !data.ok ? data : null;

    if (!response.ok || !data || !data.ok) {
      const message = errorBody?.message || `Feedback request failed with HTTP ${response.status}`;
      const code = errorBody?.code || `HTTP_${response.status}`;
      throw new FeedbackSubmissionError(message, code);
    }

    return data;
  } catch (error) {
    if (error instanceof FeedbackSubmissionError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new FeedbackSubmissionError('Feedback request timed out. Please try again.', 'TIMEOUT');
    }

    throw new FeedbackSubmissionError(
      error instanceof Error ? error.message : 'Unknown feedback submission error',
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
