import { describe, expect, it } from 'vitest';
import { buildIssueBody, buildIssueTitle } from './feedback-template';

describe('feedback issue template', () => {
  it('formats bug feedback with expected sections', () => {
    const title = buildIssueTitle({ type: 'bug', title: 'Crash on save' });
    const body = buildIssueBody({
      type: 'bug',
      title: 'Crash on save',
      details: {
        whatHappened: 'App crashed after clicking save',
        stepsToReproduce: '1. Open file\n2. Click save',
        expectedBehavior: 'File should save without crashing',
      },
      allowFollowUp: true,
      contactEmail: 'translator@example.com',
      context: {
        appVersion: '1.2.0',
        pageUrl: 'https://glossboss.app/',
        filename: 'nl.po',
        userAgent: 'Vitest',
        submittedAt: '2026-03-07T12:00:00.000Z',
      },
    });

    expect(title).toBe('[Feedback][Bug] Crash on save');
    expect(body).toContain('## What Happened');
    expect(body).toContain('## Steps To Reproduce');
    expect(body).toContain('## Expected Behavior');
    expect(body).toContain('- **Contact Email:** translator@example.com');
    expect(body).toContain('- **Filename:** nl.po');
  });

  it('formats feature feedback with expected sections', () => {
    const title = buildIssueTitle({ type: 'feature', title: 'Add term suggestions' });
    const body = buildIssueBody({
      type: 'feature',
      title: 'Add term suggestions',
      details: {
        problem: 'Hard to keep terms consistent',
        proposedSolution: 'Suggest glossary terms while typing',
        useCase: 'Translating large plugin files',
      },
      allowFollowUp: false,
      context: {
        appVersion: '1.2.0',
        pageUrl: 'https://glossboss.app/',
        userAgent: 'Vitest',
        submittedAt: '2026-03-07T12:00:00.000Z',
      },
    });

    expect(title).toBe('[Feedback][Feature] Add term suggestions');
    expect(body).toContain('## Problem / Opportunity');
    expect(body).toContain('## Proposed Solution');
    expect(body).toContain('## Use Case');
    expect(body).toContain('- **Allow Follow-Up:** No');
    expect(body).toContain('- **Contact Email:** Not provided');
  });
});
