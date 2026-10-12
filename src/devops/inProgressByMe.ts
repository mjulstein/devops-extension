// Who actually started the work, as a second reading of "in progress".
//
// Described separately from the Orphans list and kept separate on purpose: it
// asks a different question. Orphans is about where an item sits in the
// hierarchy; this is about who moved it and who holds it now, which is the
// thing that goes missing when somebody starts an item that is assigned to
// someone else, or hands one over without changing its state.
//
// Two lists, because the two cases want different handling. What is assigned to
// you and in progress is yours to finish. What you moved into progress but is
// assigned to somebody else is either a handover you made or one somebody made
// to themselves, and the assignee's name is what tells you which.
//
// The state is not named here. "In progress" is called different things in
// different processes, so it is given by the caller and never assumed.

import type { WorkItem } from '@/types';

export interface InProgressItem {
  id: number;
  title: string;
  workItemType: string;
  project: string;
  /** Who holds it now. Empty when nobody does. */
  assignedTo: string;
  url: string;
}

export interface InProgressByMe {
  /** Assigned to the user and in the state. */
  assigned: InProgressItem[];
  /** Moved into the state by the user, but held by somebody else. */
  startedForOthers: InProgressItem[];
}

/**
 * Who the queries are about.
 *
 * `@Me` keeps the user's identity out of the query, which is how the rest of
 * this project treats it. A saved `assignedTo` is an explicit override and is
 * used as given.
 */
export function identityClause(assignedTo: string): string {
  const trimmed = assignedTo.trim();
  return trimmed === '' ? '@Me' : `'${trimmed.replace(/'/g, "''")}'`;
}

function quoteState(state: string): string {
  return `'${state.trim().replace(/'/g, "''")}'`;
}

/** Items in the state and assigned to the user. */
export function buildAssignedWiql(state: string, assignedTo: string): string {
  return [
    'SELECT [System.Id] FROM WorkItems',
    `WHERE [System.State] = ${quoteState(state)}`,
    `AND [System.AssignedTo] = ${identityClause(assignedTo)}`
  ].join(' ');
}

/**
 * Items in the state, held by somebody else, that the user has ever touched.
 *
 * `EVER` is as close as WIQL gets: it says the user changed the item at some
 * point, not that they are the one who moved it into this state. Every row it
 * returns is a candidate to be confirmed against the item's own history.
 */
export function buildStartedForOthersWiql(
  state: string,
  assignedTo: string
): string {
  const identity = identityClause(assignedTo);
  return [
    'SELECT [System.Id] FROM WorkItems',
    `WHERE [System.State] = ${quoteState(state)}`,
    `AND [System.AssignedTo] <> ${identity}`,
    `AND [System.ChangedBy] EVER ${identity}`
  ].join(' ');
}

/**
 * Whether this item's history shows the user moving it into the state.
 *
 * The confirmation the `EVER` clause cannot do. An update counts only when it
 * is the one that set the state *to* this value and it was the user who made
 * it; having edited the title afterwards is not starting the work.
 */
export function wasMovedToStateBy(
  updates: unknown,
  state: string,
  identity: string
): boolean {
  if (!Array.isArray(updates) || identity.trim() === '') {
    return false;
  }
  const wanted = state.trim().toLowerCase();
  const who = identity.trim().toLowerCase();

  return updates.some((update) => {
    if (typeof update !== 'object' || update === null) {
      return false;
    }
    const entry = update as Record<string, unknown>;
    const fields = entry.fields;
    const revisedBy = entry.revisedBy;
    if (typeof fields !== 'object' || fields === null) {
      return false;
    }
    const stateChange = (fields as Record<string, unknown>)['System.State'];
    if (typeof stateChange !== 'object' || stateChange === null) {
      return false;
    }
    const newValue = (stateChange as Record<string, unknown>).newValue;
    const uniqueName =
      typeof revisedBy === 'object' && revisedBy !== null
        ? (revisedBy as Record<string, unknown>).uniqueName
        : undefined;

    return (
      typeof newValue === 'string' &&
      newValue.trim().toLowerCase() === wanted &&
      typeof uniqueName === 'string' &&
      uniqueName.trim().toLowerCase() === who
    );
  });
}

/**
 * An item as the shared row renders it.
 *
 * Drawn with the same `WorkItemRow` as every other list so a work item looks
 * like a work item wherever it turns up. The assignee is carried through, since
 * in the second list it is the thing worth reading.
 */
export function toWorkItem(item: InProgressItem): WorkItem {
  return {
    id: item.id,
    workItemType: item.workItemType,
    title: item.title,
    state: '',
    assignedTo: item.assignedTo,
    parentId: null,
    parent: null,
    closedDate: null,
    lastChangedDate: null,
    url: item.url
  };
}
