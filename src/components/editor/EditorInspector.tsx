/**
 * Inspector panel components for the editor table.
 * Contains QA issues, translation memory, review panels, and entry details.
 */

import { useState, useCallback, useMemo, memo, use } from 'react';
import {
  Badge,
  Text,
  Stack,
  Group,
  Paper,
  Tooltip,
  Textarea,
  Divider,
  Loader,
  Anchor,
  ActionIcon,
  Button,
} from '@mantine/core';
import { ExternalLink, FileCode } from 'lucide-react';
import { useEditorStore, useSourceStore, useTranslationMemoryStore } from '@/stores';
import type { POEntry } from '@/lib/po';
import { parseReferences, buildTracUrl, type ParsedReference } from '@/lib/wp-source';
import { getTranslationStatus, type TranslationStatus } from '@/types';
import {
  isReviewLocked,
  type ReviewComment,
  type ReviewEntryState,
  type ReviewStatus,
} from '@/lib/review';
import { getEffectiveProjectType, getEffectiveSlug } from '@/stores';
import { useTranslation } from '@/lib/app-language';
import { QA_RULE_LABELS, type QAEntryReport } from '@/lib/qa';
import type { TranslationMemoryScope } from '@/lib/translation-memory';
import { CollapsibleSection } from '@/components/ui';
import { SourceCodeViewer } from './SourceCodeViewer';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  REVIEW_STATUS_LABELS,
  RealtimeBroadcastContext,
  ReadOnlyContext,
  isSameReference,
  formatReviewTimestamp,
  describeReviewHistoryEvent,
  pluralSummary,
  type WorkspaceMode,
} from './editor-table-utils';

export function QaIssuesPanel({ report }: { report: QAEntryReport | null }) {
  const { t } = useTranslation();

  if (!report || report.issues.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('No QA issues for this string.')}
      </Text>
    );
  }

  return (
    <Stack gap={6}>
      {report.issues.map((issue, index) => (
        <Paper key={`${issue.ruleId}-${index}`} withBorder p="sm" radius="md">
          <Stack gap={4}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="sm" fw={500}>
                {t(QA_RULE_LABELS[issue.ruleId])}
              </Text>
              <Badge
                size="xs"
                color={issue.severity === 'error' ? 'red' : 'orange'}
                variant="light"
              >
                {issue.severity === 'error' ? t('Error') : t('Warning')}
              </Badge>
            </Group>
            {issue.details?.length ? (
              <Stack gap={2}>
                {issue.details.map((detail) => (
                  <Text key={detail} size="xs" c="dimmed">
                    {detail}
                  </Text>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

export function TranslationMemoryPanel({
  entry,
  scope,
}: {
  entry: POEntry;
  scope: TranslationMemoryScope | null;
}) {
  const { t } = useTranslation();
  const updateEntry = useEditorStore((state) => state.updateEntry);
  const updateEntryPlural = useEditorStore((state) => state.updateEntryPlural);
  const getSuggestions = useTranslationMemoryStore((state) => state.getSuggestions);

  const suggestions = useMemo(() => {
    if (!scope) return [];

    return getSuggestions(scope, entry).filter((suggestion) => {
      if (entry.msgidPlural) {
        return (
          JSON.stringify(suggestion.entry.targetTextPlural ?? []) !==
          JSON.stringify(entry.msgstrPlural ?? [])
        );
      }

      return suggestion.entry.targetText !== entry.msgstr;
    });
  }, [entry, getSuggestions, scope]);

  if (!scope) {
    return (
      <Text size="sm" c="dimmed">
        {t('Load a file with a target language before using translation memory.')}
      </Text>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('No translation memory suggestions yet.')}
      </Text>
    );
  }

  return (
    <Stack gap={6}>
      {suggestions.map((suggestion) => (
        <Paper key={`${suggestion.entry.id}-${suggestion.matchType}`} withBorder p="sm" radius="md">
          <Stack gap={6}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Group gap={6} wrap="wrap">
                <Badge
                  size="xs"
                  variant="light"
                  color={suggestion.matchType === 'exact' ? 'green' : 'blue'}
                >
                  {suggestion.matchType === 'exact' ? t('Exact match') : t('Fuzzy match')}
                </Badge>
                <Badge size="xs" variant="light" color="gray">
                  {t('{{score}}% match', { score: Math.round(suggestion.score * 100) })}
                </Badge>
              </Group>
              <Button
                size="xs"
                variant="light"
                onClick={() => {
                  if (entry.msgidPlural) {
                    updateEntryPlural(entry.id, suggestion.entry.targetTextPlural ?? ['', '']);
                    return;
                  }
                  updateEntry(entry.id, suggestion.entry.targetText);
                }}
              >
                {t('Apply')}
              </Button>
            </Group>

            {entry.msgidPlural ? (
              <Stack gap={3}>
                {(suggestion.entry.targetTextPlural ?? []).map((form, index) => (
                  <Text key={`${suggestion.entry.id}-plural-${index}`} size="sm" c="dimmed">
                    {t('Plural {{index}}: {{value}}', { index, value: form || t('Empty') })}
                  </Text>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                {suggestion.entry.targetText || t('Empty')}
              </Text>
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

export function ReviewCommentThread({
  comment,
  comments,
  onReply,
  onToggleResolved,
}: {
  comment: ReviewComment;
  comments: ReviewComment[];
  onReply: (commentId: string) => void;
  onToggleResolved: (commentId: string, resolved: boolean) => void;
}) {
  const { t } = useTranslation();
  const replies = comments.filter((candidate) => candidate.parentId === comment.id);
  const resolved = Boolean(comment.resolvedAt);

  return (
    <Stack gap={6}>
      <Paper withBorder p="sm" radius="md">
        <Stack gap={6}>
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={2}>
              <Text size="sm" fw={500}>
                {comment.author || t('Current editor')}
              </Text>
              <Text size="xs" c="dimmed">
                {formatReviewTimestamp(comment.createdAt)}
              </Text>
            </Stack>
            <Group gap={6}>
              <Button size="compact-xs" variant="subtle" onClick={() => onReply(comment.id)}>
                {t('Reply')}
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color={resolved ? 'gray' : 'green'}
                onClick={() => onToggleResolved(comment.id, !resolved)}
              >
                {resolved ? t('Reopen') : t('Resolve')}
              </Button>
            </Group>
          </Group>

          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {comment.message}
          </Text>

          {resolved && (
            <Text size="xs" c="dimmed">
              {t('Resolved by {{author}} on {{date}}', {
                author: comment.resolvedBy || t('Unknown'),
                date: comment.resolvedAt ? formatReviewTimestamp(comment.resolvedAt) : t('Unknown'),
              })}
            </Text>
          )}
        </Stack>
      </Paper>

      {replies.length > 0 && (
        <Stack gap={6} pl="md">
          {replies.map((reply) => (
            <ReviewCommentThread
              key={reply.id}
              comment={reply}
              comments={comments}
              onReply={onReply}
              onToggleResolved={onToggleResolved}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export function ReviewCommentsPanel({
  entryId,
  reviewEntry,
  isRemoteLocked = false,
}: {
  entryId: string;
  reviewEntry: ReviewEntryState;
  isRemoteLocked?: boolean;
}) {
  const { t } = useTranslation();
  const addReviewComment = useEditorStore((state) => state.addReviewComment);
  const setReviewCommentResolved = useEditorStore((state) => state.setReviewCommentResolved);
  const reviewerName = useEditorStore((state) => state.reviewerName);
  const { broadcastReviewEvent } = use(RealtimeBroadcastContext);
  const [draftComment, setDraftComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const rootComments = useMemo(
    () => reviewEntry.comments.filter((comment) => !comment.parentId),
    [reviewEntry.comments],
  );

  return (
    <Stack gap={8}>
      <Textarea
        value={draftComment}
        onChange={(event) => setDraftComment(event.currentTarget.value)}
        placeholder={
          replyTo ? t('Write a reply to this comment') : t('Add a review comment for this string')
        }
        minRows={2}
        maxRows={6}
      />

      <Group gap="xs">
        <Button
          size="xs"
          onClick={() => {
            addReviewComment(entryId, draftComment, replyTo ?? undefined);
            // Broadcast the newly added comment
            const updated = useEditorStore.getState().reviewEntries.get(entryId);
            const newComment = updated?.comments[updated.comments.length - 1];
            if (newComment) {
              broadcastReviewEvent?.({
                entryId,
                displayName: reviewerName,
                type: 'comment-added',
                data: { comment: newComment },
              });
            }
            setDraftComment('');
            setReplyTo(null);
          }}
          disabled={!draftComment.trim() || isRemoteLocked}
        >
          {replyTo ? t('Add reply') : t('Add comment')}
        </Button>
        {replyTo && (
          <Button size="xs" variant="default" onClick={() => setReplyTo(null)}>
            {t('Cancel reply')}
          </Button>
        )}
      </Group>

      {rootComments.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('No review comments yet.')}
        </Text>
      ) : (
        <Stack gap={8}>
          {rootComments.map((comment) => (
            <ReviewCommentThread
              key={comment.id}
              comment={comment}
              comments={reviewEntry.comments}
              onReply={setReplyTo}
              onToggleResolved={(commentId, resolved) => {
                setReviewCommentResolved(entryId, commentId, resolved);
                broadcastReviewEvent?.({
                  entryId,
                  displayName: reviewerName,
                  type: 'comment-resolved',
                  data: { commentId, resolved },
                });
              }}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export function ReviewHistoryPanel({ reviewEntry }: { reviewEntry: ReviewEntryState }) {
  const { t } = useTranslation();
  const history = useMemo(
    () => [...reviewEntry.history].reverse().slice(0, 12),
    [reviewEntry.history],
  );

  if (history.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {t('No review history yet.')}
      </Text>
    );
  }

  return (
    <Stack gap={6}>
      {history.map((event) => (
        <Paper key={event.id} withBorder p="sm" radius="md">
          <Stack gap={4}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Text size="sm" fw={500}>
                {describeReviewHistoryEvent(event, t)}
              </Text>
              <Text size="xs" c="dimmed">
                {formatReviewTimestamp(event.createdAt)}
              </Text>
            </Group>
            <Text size="xs" c="dimmed">
              {t('By {{actor}}', { actor: event.actor || t('Current editor') })}
            </Text>
            {(event.type === 'translation-updated' || event.type === 'comment-added') &&
              event.to && (
                <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                  {event.to}
                </Text>
              )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

export function ReviewPanel({
  entry,
  reviewEntry,
  isRemoteLocked = false,
}: {
  entry: POEntry;
  reviewEntry: ReviewEntryState;
  isRemoteLocked?: boolean;
}) {
  const { t } = useTranslation();
  const setReviewStatus = useEditorStore((state) => state.setReviewStatus);
  const clearFuzzyBatch = useEditorStore((state) => state.clearFuzzyBatch);
  const addFuzzyBatch = useEditorStore((state) => state.addFuzzyBatch);
  const lockApprovedEntries = useEditorStore((state) => state.lockApprovedEntries);
  const reviewerName = useEditorStore((state) => state.reviewerName);
  const { broadcastReviewEvent } = use(RealtimeBroadcastContext);
  const editorReadOnly = use(ReadOnlyContext);
  const translationStatus = getTranslationStatus(entry.msgstr, entry.flags, entry.msgstrPlural);
  const locked = editorReadOnly || isReviewLocked(reviewEntry.status, lockApprovedEntries);
  const unresolvedCount = reviewEntry.comments.filter((comment) => !comment.resolvedAt).length;
  const canApprove = reviewEntry.status !== 'approved';
  const canUnapprove = reviewEntry.status === 'approved';
  const canRequestChanges =
    reviewEntry.status !== 'needs-changes' && reviewEntry.status !== 'approved';

  const handleApprove = useCallback(() => {
    if (entry.flags.includes('fuzzy')) {
      clearFuzzyBatch([entry.id]);
    }
    setReviewStatus(entry.id, 'approved');
    broadcastReviewEvent?.({
      entryId: entry.id,
      displayName: reviewerName,
      type: 'status-changed',
      data: { status: 'approved' },
    });
  }, [clearFuzzyBatch, entry.flags, entry.id, setReviewStatus, broadcastReviewEvent, reviewerName]);

  const handleUnapprove = useCallback(() => {
    setReviewStatus(entry.id, 'in-review');
    broadcastReviewEvent?.({
      entryId: entry.id,
      displayName: reviewerName,
      type: 'status-changed',
      data: { status: 'in-review' },
    });
  }, [entry.id, setReviewStatus, broadcastReviewEvent, reviewerName]);

  const handleRequestChanges = useCallback(() => {
    setReviewStatus(entry.id, 'needs-changes');
    broadcastReviewEvent?.({
      entryId: entry.id,
      displayName: reviewerName,
      type: 'status-changed',
      data: { status: 'needs-changes' },
    });

    if (translationStatus !== 'untranslated' && !entry.flags.includes('fuzzy')) {
      addFuzzyBatch([entry.id]);
    }
  }, [
    addFuzzyBatch,
    entry.flags,
    entry.id,
    setReviewStatus,
    translationStatus,
    broadcastReviewEvent,
    reviewerName,
  ]);

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="xs" wrap="wrap">
          <ReviewStatusBadge status={reviewEntry.status} />
          {locked && (
            <Badge color="gray" variant="light" size="sm">
              {t('Locked')}
            </Badge>
          )}
          {unresolvedCount > 0 && (
            <Badge color="red" variant="light" size="sm">
              {t('{{count}} unresolved', { count: unresolvedCount })}
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="wrap">
          <Button
            size="xs"
            variant="light"
            color="green"
            onClick={handleApprove}
            disabled={!canApprove || isRemoteLocked}
          >
            {t('Approve')}
          </Button>
          <Button
            size="xs"
            variant="default"
            onClick={handleUnapprove}
            disabled={!canUnapprove || isRemoteLocked}
          >
            {t('Unapprove')}
          </Button>
          <Button
            size="xs"
            variant="light"
            color="orange"
            onClick={handleRequestChanges}
            disabled={!canRequestChanges || isRemoteLocked}
          >
            {t('Request changes')}
          </Button>
        </Group>
      </Group>

      {lockApprovedEntries && (
        <Text size="xs" c="dimmed">
          {t('Approved strings stay read-only until they are unapproved.')}
        </Text>
      )}

      {translationStatus !== 'untranslated' && (
        <Group>
          <Button
            size="xs"
            variant="default"
            disabled={isRemoteLocked}
            onClick={() => {
              if (translationStatus === 'fuzzy') {
                clearFuzzyBatch([entry.id]);
              } else {
                addFuzzyBatch([entry.id]);
              }
            }}
          >
            {translationStatus === 'fuzzy' ? t('Clear fuzzy flag') : t('Mark as fuzzy')}
          </Button>
        </Group>
      )}

      <Stack gap={6}>
        <Text size="xs" fw={600} c="dimmed">
          {t('Comments')}
        </Text>
        <ReviewCommentsPanel
          entryId={entry.id}
          reviewEntry={reviewEntry}
          isRemoteLocked={isRemoteLocked}
        />
      </Stack>

      <Divider />

      <Stack gap={6}>
        <Text size="xs" fw={600} c="dimmed">
          {t('Change history')}
        </Text>
        <ReviewHistoryPanel reviewEntry={reviewEntry} />
      </Stack>
    </Stack>
  );
}

export const ReviewStatusBadge = memo(function ReviewStatusBadge({
  status,
  compact = false,
}: {
  status: ReviewStatus;
  compact?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Badge
      color={REVIEW_STATUS_COLORS[status]}
      variant="light"
      size={compact ? 'xs' : 'sm'}
      style={{ flexShrink: 0 }}
    >
      {t(REVIEW_STATUS_LABELS[status])}
    </Badge>
  );
});

export function EntryDetailsPanel({
  entry,
  status,
  isModified,
  isMT,
  qaReport = null,
  reviewEntry = {
    status: 'draft',
    comments: [],
    history: [],
  },
  translationMemoryScope = null,
  onActivateReference,
  mode = 'edit',
  isRemoteLocked = false,
}: {
  entry: POEntry;
  status: TranslationStatus;
  isModified: boolean;
  isMT: boolean;
  qaReport?: QAEntryReport | null;
  reviewEntry?: ReviewEntryState;
  translationMemoryScope?: TranslationMemoryScope | null;
  onActivateReference: (ref: ParsedReference) => void;
  mode?: WorkspaceMode;
  isRemoteLocked?: boolean;
}) {
  const { t } = useTranslation();
  const projectType = useSourceStore((state) => getEffectiveProjectType(state));
  const projectSlug = useSourceStore((state) => getEffectiveSlug(state));
  const basePath = useSourceStore((state) => state.resolvedBasePath);
  const activeReference = useSourceStore((s) => s.activeReference);
  const sourceContent = useSourceStore((s) => s.sourceContent);
  const sourceError = useSourceStore((s) => s.sourceError);
  const isLoadingSource = useSourceStore((s) => s.isLoadingSource);

  const parsedRefs = useMemo(() => parseReferences(entry.references), [entry.references]);
  const entryActiveReference = useMemo(
    () => parsedRefs.find((ref) => isSameReference(activeReference, ref)) ?? null,
    [activeReference, parsedRefs],
  );
  const flags = entry.flags.filter((f) => f !== 'fuzzy');

  const qaIssueCount = (qaReport?.errorCount ?? 0) + (qaReport?.warningCount ?? 0);
  const commentCount = entry.translatorComments.length + entry.extractedComments.length;
  const unresolvedReviewCount = reviewEntry.comments.filter((c) => !c.resolved).length;

  return (
    <Stack gap={4} data-testid={`entry-details-${entry.id}`}>
      {/* Status badges -- always visible */}
      <Group gap="xs" wrap="wrap">
        <Badge color={STATUS_COLORS[status]} variant="light" size="sm">
          {t(STATUS_LABELS[status])}
        </Badge>
        {isModified && (
          <Badge color="orange" variant="light" size="sm">
            {t('Modified')}
          </Badge>
        )}
        {isMT && (
          <Badge color="blue" variant="light" size="sm">
            MT
          </Badge>
        )}
        {entry.lineNumber && (
          <Badge color="gray" variant="light" size="sm">
            {t('Line {{lineNumber}}', { lineNumber: entry.lineNumber })}
          </Badge>
        )}
      </Group>

      {/* Context -- always visible */}
      <Group align="flex-start" grow>
        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            {t('Context')}
          </Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {entry.msgctxt || t('No context')}
          </Text>
        </Stack>
        {entry.sourceText && (
          <Stack gap={4}>
            <Text size="xs" fw={600} c="dimmed">
              {t('Key')}
            </Text>
            <Text size="sm" ff="monospace" style={{ wordBreak: 'break-all' }}>
              {entry.msgid}
            </Text>
          </Stack>
        )}
        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            {t('Structure')}
          </Text>
          <Text size="sm">{pluralSummary(entry, t)}</Text>
        </Stack>
      </Group>

      {/* QA Checks -- open if issues exist */}
      <CollapsibleSection
        title={t('QA checks')}
        badge={
          qaIssueCount > 0 ? (
            <Badge size="xs" variant="light" color={qaReport?.errorCount ? 'red' : 'orange'}>
              {qaIssueCount}
            </Badge>
          ) : null
        }
        defaultOpen={qaIssueCount > 0}
      >
        <QaIssuesPanel report={qaReport} />
      </CollapsibleSection>

      {/* Translation Memory -- collapsed by default */}
      <CollapsibleSection title={t('Translation memory')}>
        <TranslationMemoryPanel entry={entry} scope={translationMemoryScope} />
      </CollapsibleSection>

      {/* References -- collapsed by default, open if active reference */}
      <CollapsibleSection
        title={t('References')}
        badge={
          parsedRefs.length > 0 ? (
            <Badge size="xs" variant="light" color="gray">
              {parsedRefs.length}
            </Badge>
          ) : null
        }
        defaultOpen={Boolean(entryActiveReference)}
      >
        {parsedRefs.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t('No source references')}
          </Text>
        ) : (
          <Stack gap={4}>
            {parsedRefs.map((ref) => {
              const refLabel = `${ref.path}${ref.line ? `:${ref.line}` : ''}`;
              const isActiveRef = isSameReference(activeReference, ref);
              return (
                <Group key={refLabel} gap="xs" justify="space-between" wrap="nowrap">
                  <Anchor
                    component="button"
                    type="button"
                    size="sm"
                    c={isActiveRef ? 'blue' : 'dimmed'}
                    style={{ textAlign: 'left' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivateReference(ref);
                    }}
                  >
                    <Group gap={4} wrap="nowrap">
                      <FileCode size={12} />
                      <Text size="sm" component="span">
                        {refLabel}
                      </Text>
                    </Group>
                  </Anchor>

                  {projectSlug && projectType && (
                    <Tooltip label={t('Open in Trac')}>
                      <ActionIcon
                        component="a"
                        href={buildTracUrl(
                          projectType,
                          projectSlug,
                          ref.path,
                          ref.line ?? undefined,
                          basePath,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="subtle"
                        size="sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={14} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              );
            })}
          </Stack>
        )}
      </CollapsibleSection>

      {/* Source Preview -- collapsed by default */}
      {projectSlug && (
        <CollapsibleSection
          title={t('Source preview')}
          defaultOpen={Boolean(entryActiveReference && sourceContent)}
        >
          {parsedRefs.length > 0 && !entryActiveReference && (
            <Text size="sm" c="dimmed">
              {t('Select a reference above to load source context.')}
            </Text>
          )}

          {entryActiveReference && isLoadingSource && (
            <Group gap="xs">
              <Loader size="sm" />
              <Text size="sm" c="dimmed">
                {t('Loading source...')}
              </Text>
            </Group>
          )}

          {entryActiveReference && sourceError && !isLoadingSource && (
            <Text size="sm" c="red">
              {sourceError}
            </Text>
          )}

          {entryActiveReference && sourceContent && !isLoadingSource && (
            <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
              <SourceCodeViewer
                content={sourceContent}
                targetLine={entryActiveReference.line}
                filePath={entryActiveReference.path}
                maxHeight={280}
              />
            </Paper>
          )}

          {parsedRefs.length === 0 && (
            <Text size="sm" c="dimmed">
              {t('No source references for this entry.')}
            </Text>
          )}
        </CollapsibleSection>
      )}

      {/* Review -- open in review mode */}
      {mode === 'review' && (
        <CollapsibleSection
          title={t('Review')}
          badge={
            unresolvedReviewCount > 0 ? (
              <Badge size="xs" variant="light" color="red">
                {unresolvedReviewCount}
              </Badge>
            ) : null
          }
          defaultOpen
        >
          <ReviewPanel entry={entry} reviewEntry={reviewEntry} isRemoteLocked={isRemoteLocked} />
        </CollapsibleSection>
      )}

      {/* Comments -- collapsed by default */}
      {commentCount > 0 && (
        <CollapsibleSection
          title={t('Comments')}
          badge={
            <Badge size="xs" variant="light" color="gray">
              {commentCount}
            </Badge>
          }
        >
          <Group align="flex-start" grow>
            {entry.translatorComments.length > 0 && (
              <Stack gap={4}>
                <Text size="xs" fw={600} c="dimmed">
                  {t('Translator comments')}
                </Text>
                <Stack gap={3}>
                  {entry.translatorComments.map((comment, idx) => (
                    <Text key={`${entry.id}-translator-comment-${idx}`} size="sm">
                      {comment}
                    </Text>
                  ))}
                </Stack>
              </Stack>
            )}
            {entry.extractedComments.length > 0 && (
              <Stack gap={4}>
                <Text size="xs" fw={600} c="dimmed">
                  {t('Extracted comments')}
                </Text>
                <Stack gap={3}>
                  {entry.extractedComments.map((comment, idx) => (
                    <Text key={`${entry.id}-extracted-comment-${idx}`} size="sm">
                      {comment}
                    </Text>
                  ))}
                </Stack>
              </Stack>
            )}
          </Group>
        </CollapsibleSection>
      )}

      {/* Flags -- collapsed by default */}
      {flags.length > 0 && (
        <CollapsibleSection title={t('Flags')}>
          <Group gap={6} wrap="wrap">
            {flags.map((flag) => (
              <Badge key={`${entry.id}-flag-${flag}`} size="xs" variant="light" color="gray">
                {flag}
              </Badge>
            ))}
          </Group>
        </CollapsibleSection>
      )}
    </Stack>
  );
}
