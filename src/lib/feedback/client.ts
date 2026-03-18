import type { FeedbackIssueRequest, FeedbackIssueResponse, FeedbackIssueSuccess } from './types';
import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';

const REQUEST_TIMEOUT_MS = 20000;

export class FeedbackSubmissionError extends Error {
  code: string;

  constructor(message: string, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'FeedbackSubmissionError';
    this.code = code;
  }
}

export async function submitFeedbackIssue(
  payload: FeedbackIssueRequest,
): Promise<FeedbackIssueSuccess> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const { data, error, response } = await invokeSupabaseFunction<FeedbackIssueResponse>(
      'feedback-issue',
      {
        featureLabel: 'Feedback',
        signal: controller.signal,
        body: payload,
      },
    );

    if (error) {
      if (controller.signal.aborted) {
        throw new FeedbackSubmissionError(
          'Feedback request timed out. Please try again.',
          'TIMEOUT',
        );
      }

      const errorBody = (await readSupabaseFunctionError(response)) as Record<string, unknown>;
      const message =
        typeof errorBody['message'] === 'string'
          ? errorBody['message']
          : `Feedback request failed with HTTP ${response?.status ?? 'unknown'}`;
      const code =
        typeof errorBody['code'] === 'string'
          ? errorBody['code']
          : `HTTP_${response?.status ?? 'UNKNOWN'}`;
      throw new FeedbackSubmissionError(message, code);
    }

    if (!data || !data.ok) {
      const message = data?.message || 'Unknown feedback submission error';
      const code = data?.code || 'REQUEST_FAILED';
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
