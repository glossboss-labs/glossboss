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

export type FeedbackDetails = BugFeedbackDetails | FeatureFeedbackDetails;

export interface FeedbackIssueInput {
  type: FeedbackType;
  title: string;
  details: FeedbackDetails;
  contactEmail?: string;
  allowFollowUp?: boolean;
  context: FeedbackContext;
}

function isBugDetails(details: FeedbackDetails): details is BugFeedbackDetails {
  return (
    'whatHappened' in details && 'stepsToReproduce' in details && 'expectedBehavior' in details
  );
}

function formatLine(label: string, value: string): string {
  return `- **${label}:** ${value || 'N/A'}`;
}

export function buildIssueTitle(input: Pick<FeedbackIssueInput, 'type' | 'title'>): string {
  const prefix = input.type === 'bug' ? '[Feedback][Bug]' : '[Feedback][Feature]';
  return `${prefix} ${input.title.trim()}`;
}

export function buildIssueBody(input: FeedbackIssueInput): string {
  const sections: string[] = [];

  sections.push('## Feedback Type');
  sections.push(input.type === 'bug' ? 'Bug Report' : 'Feature Request');
  sections.push('');

  sections.push('## Summary');
  sections.push(input.title.trim());
  sections.push('');

  if (isBugDetails(input.details)) {
    sections.push('## What Happened');
    sections.push(input.details.whatHappened.trim());
    sections.push('');

    sections.push('## Steps To Reproduce');
    sections.push(input.details.stepsToReproduce.trim());
    sections.push('');

    sections.push('## Expected Behavior');
    sections.push(input.details.expectedBehavior.trim());
    sections.push('');
  } else {
    sections.push('## Problem / Opportunity');
    sections.push(input.details.problem.trim());
    sections.push('');

    sections.push('## Proposed Solution');
    sections.push(input.details.proposedSolution.trim());
    sections.push('');

    sections.push('## Use Case');
    sections.push(input.details.useCase.trim());
    sections.push('');
  }

  sections.push('## Follow-Up');
  sections.push(formatLine('Allow Follow-Up', input.allowFollowUp ? 'Yes' : 'No'));
  if (input.allowFollowUp && input.contactEmail?.trim()) {
    sections.push(formatLine('Contact Email', input.contactEmail.trim()));
  }
  sections.push('');

  sections.push('## Submission Context');
  sections.push(formatLine('App Version', input.context.appVersion));
  sections.push(formatLine('Page URL', input.context.pageUrl));
  sections.push(formatLine('Filename', input.context.filename || 'N/A'));
  sections.push(formatLine('User Agent', input.context.userAgent));
  sections.push(formatLine('Submitted At', input.context.submittedAt));

  return sections.join('\n');
}

export function getLabelsForType(type: FeedbackType): string[] {
  if (type === 'bug') {
    return ['feedback', 'bug'];
  }
  return ['feedback', 'enhancement'];
}
