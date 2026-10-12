// Work items you raised that are not under anything.
//
// An item with no parent is invisible to every rollup: it is not in a feature's
// burndown, not in its parent's children, and it only surfaces when somebody
// goes looking. They accumulate quietly, which is why they want a list of their
// own and a way to fix them several at a time rather than one work item page at
// a time.
//
// What may go under what is the hierarchy's rule, not this view's: a Task goes
// under a Bug, PBI, Improvement or another Task, and those backlog types go
// under a Feature. The rule lives here and `parentAssignment.ts` uses it too,
// so the bulk action and the single action can never disagree about what is
// legal.

import { isSupportedParentType } from './workItemDetails';

/** The types this view lists. Anything else is somebody else's hierarchy. */
export const ORPHAN_WORK_ITEM_TYPES = [
  'Bug',
  'Product Backlog Item',
  'Improvement',
  'Task'
] as const;

export function isTaskType(workItemType: string): boolean {
  return workItemType.trim().toLowerCase() === 'task';
}

export function isFeatureType(workItemType: string): boolean {
  return workItemType.trim().toLowerCase() === 'feature';
}

/**
 * Why this parent will not do, or null when it will.
 *
 * Returning the reason rather than a boolean is deliberate: every caller has to
 * tell the user *why*, and a boolean makes each of them invent its own wording
 * for a rule that is not theirs.
 */
export function describeParentMismatch(
  childType: string,
  parentType: string
): string | null {
  if (isTaskType(childType)) {
    // A Task under another Task is allowed: breaking a task into smaller tasks
    // is something the process permits, so the view does not get to forbid it.
    return isSupportedParentType(parentType) || isTaskType(parentType)
      ? null
      : `A Task goes under a Bug, Product Backlog Item, Improvement or another Task. #PARENT# is a ${parentType || 'work item of unknown type'}.`;
  }

  if (isSupportedParentType(childType)) {
    return isFeatureType(parentType)
      ? null
      : `A ${childType} goes under a Feature. #PARENT# is a ${parentType || 'work item of unknown type'}.`;
  }

  return `${childType || 'This work item'} is not one this view knows how to parent.`;
}

export interface OrphanCandidate {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  /** The parent it already has, if any. */
  parentId: number | null;
  url: string;
}

export interface OrphanSelection {
  /** Ids the user has ticked. */
  ids: number[];
  /** Everything on offer, for looking types up. */
  candidates: OrphanCandidate[];
}

/**
 * The ones worth showing: no parent, and not deliberately parentless.
 *
 * The quick-task parent and its archive are excluded by id. They are holders
 * for work that has nowhere else to go, so being parentless is their whole
 * purpose and offering to fix it would be offering to break them.
 */
export function selectOrphans(
  candidates: OrphanCandidate[],
  excludedIds: number[]
): OrphanCandidate[] {
  const excluded = new Set(excludedIds.filter((id) => Number.isFinite(id)));
  return candidates.filter(
    (candidate) => candidate.parentId === null && !excluded.has(candidate.id)
  );
}

/** Reads the deliberately parentless ids out of the saved settings. */
export function parentlessByDesign(settings: {
  quickTaskParentId: string;
  quickTaskArchiveId: string;
}): number[] {
  return [settings.quickTaskParentId, settings.quickTaskArchiveId]
    .map((value) => Number(value.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export interface BulkParentCheck {
  /** Ids that may be moved under this parent. */
  allowed: number[];
  /** Why the others may not, one message each. */
  refused: { id: number; reason: string }[];
}

/**
 * Which of the ticked items may go under this parent.
 *
 * Partial rather than all-or-nothing: a selection of Tasks and Bugs is a
 * perfectly ordinary thing to tick before noticing they cannot share a parent,
 * and refusing the whole batch would make the user do the sorting the view is
 * supposed to do for them.
 */
export function checkBulkParent(
  selection: OrphanSelection,
  parentId: number,
  parentType: string
): BulkParentCheck {
  const byId = new Map(
    selection.candidates.map((candidate) => [candidate.id, candidate])
  );
  const allowed: number[] = [];
  const refused: { id: number; reason: string }[] = [];

  for (const id of selection.ids) {
    const candidate = byId.get(id);
    if (candidate === undefined) {
      continue;
    }
    if (id === parentId) {
      refused.push({ id, reason: 'A work item cannot be its own parent.' });
      continue;
    }
    const mismatch = describeParentMismatch(candidate.workItemType, parentType);
    if (mismatch === null) {
      allowed.push(id);
    } else {
      refused.push({
        id,
        reason: mismatch.replace('#PARENT#', `#${parentId}`)
      });
    }
  }

  return { allowed, refused };
}
