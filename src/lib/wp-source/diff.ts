import { mergePotIntoPo } from '@/lib/po';
import type { POEntry } from '@/lib/po/types';

export type ReleaseDeltaKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface ReleaseDiffSummary {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  metaUpdated: number;
}

export interface ReleaseDiffResult {
  summary: ReleaseDiffSummary;
  mergeEntries: POEntry[];
  deltaEntryIds: Set<string>;
}

function entryKey(entry: Pick<POEntry, 'msgid' | 'msgctxt'>): string {
  return entry.msgctxt ? `${entry.msgctxt}\x04${entry.msgid}` : entry.msgid;
}

function metadataChanged(current: POEntry, upstream: POEntry): boolean {
  if ((current.msgidPlural ?? '') !== (upstream.msgidPlural ?? '')) {
    return true;
  }

  if (current.references.length !== upstream.references.length) {
    return true;
  }

  if (
    current.references.some((reference, index) => reference !== upstream.references[index]) ||
    current.extractedComments.length !== upstream.extractedComments.length ||
    current.extractedComments.some(
      (comment, index) => comment !== upstream.extractedComments[index],
    )
  ) {
    return true;
  }

  return false;
}

export function diffEntriesAgainstTemplate(
  currentEntries: POEntry[],
  upstreamEntries: POEntry[],
): ReleaseDiffResult {
  const currentMap = new Map(currentEntries.map((entry) => [entryKey(entry), entry]));
  const upstreamMap = new Map(upstreamEntries.map((entry) => [entryKey(entry), entry]));

  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;
  let metaUpdated = 0;

  for (const [key, upstreamEntry] of upstreamMap) {
    const currentEntry = currentMap.get(key);
    if (!currentEntry) {
      added += 1;
      continue;
    }

    if (metadataChanged(currentEntry, upstreamEntry)) {
      changed += 1;
      metaUpdated += 1;
    } else {
      unchanged += 1;
    }
  }

  for (const key of currentMap.keys()) {
    if (!upstreamMap.has(key)) {
      removed += 1;
    }
  }

  const mergeResult = mergePotIntoPo(currentEntries, upstreamEntries);
  const deltaEntryIds = new Set<string>();

  for (const entry of mergeResult.entries) {
    const key = entryKey(entry);
    if (
      !currentMap.has(key) ||
      (currentMap.has(key) && metadataChanged(currentMap.get(key)!, upstreamMap.get(key)!))
    ) {
      deltaEntryIds.add(entry.id);
    }
  }

  return {
    summary: {
      added,
      removed,
      changed,
      unchanged,
      metaUpdated,
    },
    mergeEntries: mergeResult.entries,
    deltaEntryIds,
  };
}
