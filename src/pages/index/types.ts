import type { FeedbackIssueSuccess } from '@/lib/feedback';
import type { DraftData } from '@/lib/storage';

export interface DownloadInfo {
  filename: string;
  size: string;
}

export interface MergeInfo {
  potFilename: string;
  kept: number;
  added: number;
  removed: number;
  updatedMeta: number;
}

export type FeedbackInfo = Pick<FeedbackIssueSuccess, 'referenceId'>;

export interface PendingDraft {
  draft: DraftData;
  filename: string;
}
