export type FeedbackType = 'bug' | 'feature';

export interface BugFeedbackDetails {
  whatHappened: string;
  stepsToReproduce: string;
  expectedBehavior: string;
}

export interface FeatureFeedbackDetails {
  problem: string;
  proposedSolution: string;
  useCase: string;
}

export interface FeedbackContext {
  appVersion: string;
  pageUrl: string;
  filename?: string;
  userAgent: string;
  submittedAt: string;
}

export interface FeedbackIssueRequest {
  type: FeedbackType;
  title: string;
  details: BugFeedbackDetails | FeatureFeedbackDetails;
  contactEmail?: string;
  allowFollowUp?: boolean;
  context: FeedbackContext;
  turnstileToken: string;
  website: string;
}

export interface FeedbackIssueSuccess {
  ok: true;
  issueNumber: number;
  issueUrl: string;
}

export interface FeedbackIssueError {
  ok: false;
  code: string;
  message: string;
}

export type FeedbackIssueResponse = FeedbackIssueSuccess | FeedbackIssueError;
