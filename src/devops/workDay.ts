// The last working day: which day the user last did real work in Azure DevOps,
// and what that work was.
//
// "Real work" is a local-time calendar day with at least N changes made by the
// subject user, so a stray weekend comment does not count as a working day.
// Everything here is pure; the calls live in `workDayApi.ts`.
//
// Days are local-time `YYYY-MM-DD` keys, midnight to midnight, because that is
// what Azure DevOps's own UI shows. The search walks back in fixed windows, and
// a window that held nothing is remembered (per user and N) so it is never
// searched again: a past day's history does not change.

import { isObject } from './typeGuards';
import { identityClause } from './inProgressByMe';

/** How many days one search window covers. */
export const WINDOW_DAYS = 15;

export const DEFAULT_MIN_CHANGES = 3;

export type ChangeKind = 'created' | 'state' | 'commented' | 'edited';

/** One update the subject user made to one work item. */
export interface ActivityChange {
  id: number;
  /** ISO timestamp of the change. */
  at: string;
  kind: ChangeKind;
  /** The new state, for `kind === 'state'` (also set on `created`). */
  state?: string;
}

/** A local-time day as `YYYY-MM-DD`. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The local midnight a day key stands for. */
export function dayStart(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const date = dayStart(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

/** An inclusive day range, `from <= to`. */
export interface DayRange {
  from: string;
  to: string;
}

/**
 * The window ending at `to`, shortened past any part already known to be empty.
 *
 * Returns the range to fetch, or the day to continue from when the whole window
 * is already covered. Empty ranges are inclusive and may overlap.
 */
export function nextWindow(to: string, emptyRanges: DayRange[]): DayRange {
  let end = to;
  // Skip back over any empty range that covers the end, repeatedly, since
  // ranges recorded at different times can chain.
  for (;;) {
    const covering = emptyRanges.find((r) => r.from <= end && end <= r.to);
    if (!covering) {
      break;
    }
    end = addDays(covering.from, -1);
  }
  let from = addDays(end, -(WINDOW_DAYS - 1));
  // Stop short of an empty range that starts inside the window.
  for (const range of emptyRanges) {
    if (range.to < end && range.to >= from) {
      from = addDays(range.to, 1);
    }
  }
  return { from, to: end };
}

/** Adds a range to the record, merging what touches or overlaps. */
export function recordEmpty(ranges: DayRange[], added: DayRange): DayRange[] {
  const all = [...ranges, added].sort((a, b) => (a.from < b.from ? -1 : 1));
  const merged: DayRange[] = [];
  for (const range of all) {
    const last = merged[merged.length - 1];
    if (last && range.from <= addDays(last.to, 1)) {
      if (range.to > last.to) {
        last.to = range.to;
      }
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/** Key the empty-window record by everything that decides what counts. */
export function emptyRangesKey(assignedTo: string, minChanges: number): string {
  return `${assignedTo.trim().toLowerCase() || '@me'}|${minChanges}`;
}

/** Reads the N setting, falling back to the default for anything unusable. */
export function parseMinChanges(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : DEFAULT_MIN_CHANGES;
}

/** Candidates: items the user ever changed, changed again on or after `from`. */
export function buildActivityWiql(assignedTo: string, from: string): string {
  const identity = identityClause(assignedTo);
  return [
    'SELECT [System.Id] FROM WorkItems',
    `WHERE [System.ChangedBy] EVER ${identity}`,
    `AND [System.ChangedDate] >= '${from}'`
  ].join(' ');
}

function sameUser(revisedBy: unknown, identity: string): boolean {
  if (!isObject(revisedBy)) {
    return false;
  }
  const who = identity.trim().toLowerCase();
  return [revisedBy.uniqueName, revisedBy.displayName].some(
    (name) => typeof name === 'string' && name.trim().toLowerCase() === who
  );
}

function newValue(fields: Record<string, unknown>, name: string): unknown {
  const field = fields[name];
  return isObject(field) ? field.newValue : undefined;
}

/**
 * The subject user's changes from one item's `/updates`.
 *
 * An update's own `revisedDate` is when it was superseded, so the time is read
 * from the `System.ChangedDate` it set. Updates with no field changes (link-only
 * or attachment-only) still count as edits when they carry a time.
 */
export function extractChanges(
  id: number,
  updates: unknown,
  identity: string
): ActivityChange[] {
  if (!Array.isArray(updates) || identity.trim() === '') {
    return [];
  }
  const changes: ActivityChange[] = [];
  for (const update of updates) {
    if (!isObject(update) || !sameUser(update.revisedBy, identity)) {
      continue;
    }
    const fields = isObject(update.fields) ? update.fields : {};
    const at = newValue(fields, 'System.ChangedDate');
    if (typeof at !== 'string') {
      continue;
    }
    const state = newValue(fields, 'System.State');
    const stateText = typeof state === 'string' ? state : undefined;
    let kind: ChangeKind;
    if (update.rev === 1) {
      kind = 'created';
    } else if (stateText !== undefined) {
      kind = 'state';
    } else if (newValue(fields, 'System.History') !== undefined) {
      kind = 'commented';
    } else {
      kind = 'edited';
    }
    changes.push({ id, at, kind, ...(stateText ? { state: stateText } : {}) });
  }
  return changes;
}

/** Changes per local day. */
export function countByDay(changes: ActivityChange[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const change of changes) {
    const key = dayKey(new Date(change.at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Working days inside a range, newest first. */
export function workingDays(
  changes: ActivityChange[],
  range: DayRange,
  minChanges: number
): string[] {
  return [...countByDay(changes)]
    .filter(
      ([day, count]) =>
        day >= range.from && day <= range.to && count >= minChanges
    )
    .map(([day]) => day)
    .sort()
    .reverse();
}

/** What the user did to one item on the day, for the item's row. */
export interface DayItemSummary {
  id: number;
  /** Latest change that day, ISO. */
  lastAt: string;
  changeCount: number;
  /** Short phrases, in the order they first happened. */
  actions: string[];
  /** The state the user last moved it to that day, if any. */
  movedTo?: string;
  created: boolean;
}

export function summariseDay(
  changes: ActivityChange[],
  day: string
): DayItemSummary[] {
  const byId = new Map<number, ActivityChange[]>();
  for (const change of changes) {
    if (dayKey(new Date(change.at)) !== day) {
      continue;
    }
    const list = byId.get(change.id) ?? [];
    list.push(change);
    byId.set(change.id, list);
  }

  const summaries: DayItemSummary[] = [];
  for (const [id, list] of byId) {
    list.sort((a, b) => (a.at < b.at ? -1 : 1));
    const actions: string[] = [];
    const add = (phrase: string) => {
      if (!actions.includes(phrase)) {
        actions.push(phrase);
      }
    };
    let movedTo: string | undefined;
    for (const change of list) {
      if (change.kind === 'created') {
        add('created');
      } else if (change.kind === 'state' && change.state) {
        movedTo = change.state;
        add(`→ ${change.state}`);
      } else if (change.kind === 'commented') {
        add('commented');
      } else {
        add('edited');
      }
    }
    summaries.push({
      id,
      lastAt: list[list.length - 1].at,
      changeCount: list.length,
      actions,
      movedTo,
      created: list.some((c) => c.kind === 'created')
    });
  }
  return summaries.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

/** The current facts about an item that decide whether it is a loose end. */
export interface ItemNow {
  id: number;
  state: string;
  assignedTo: string;
  parentId: number | null;
}

export interface LooseEnds {
  /** Moved to a state that day and still in it. */
  stillInState: number[];
  /** Created that day and under nothing. */
  createdWithoutParent: number[];
  /** Moved that day, now held by somebody else. */
  handedOver: number[];
}

const FINISHED = new Set(['done', 'closed', 'removed', 'resolved']);

export function findLooseEnds(
  summaries: DayItemSummary[],
  now: ItemNow[],
  identity: string
): LooseEnds {
  const byId = new Map(now.map((item) => [item.id, item]));
  const who = identity.trim().toLowerCase();
  const result: LooseEnds = {
    stillInState: [],
    createdWithoutParent: [],
    handedOver: []
  };
  for (const summary of summaries) {
    const item = byId.get(summary.id);
    if (!item) {
      continue;
    }
    const finished = FINISHED.has(item.state.trim().toLowerCase());
    if (summary.movedTo && !finished) {
      const holder = item.assignedTo.trim().toLowerCase();
      if (holder !== '' && who !== '' && holder !== who) {
        result.handedOver.push(item.id);
      } else if (
        item.state.trim().toLowerCase() === summary.movedTo.trim().toLowerCase()
      ) {
        result.stillInState.push(item.id);
      }
    }
    if (summary.created && item.parentId === null && !finished) {
      result.createdWithoutParent.push(item.id);
    }
  }
  return result;
}
