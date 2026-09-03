import { sanitizeStarredPages, type StarredPage } from '../starredPages';

// Draft state for the favorites editor, kept out of the component so it can be
// tested without a DOM — this repo's component tests render static markup only.
//
// The draft holds text exactly as typed. Nothing is trimmed or normalised until
// commit: doing it per keystroke is what made a trailing space impossible to
// enter, because it was removed again before the next character arrived.

export interface DraftRow {
  key: string;
  page: StarredPage;
}

let nextRowKey = 0;

/**
 * Rows carry their own key because the address is editable: keying on the url
 * would remount a row mid-edit, and keying on the index would confuse React as
 * soon as a row moved or was removed.
 */
export function createDraft(pages: StarredPage[]): DraftRow[] {
  return pages.map((page) => ({ key: `row-${nextRowKey++}`, page }));
}

export function draftPages(rows: DraftRow[]): StarredPage[] {
  return rows.map((row) => row.page);
}

export function editRow(
  rows: DraftRow[],
  key: string,
  patch: Partial<StarredPage>
): DraftRow[] {
  return rows.map((row) =>
    row.key === key ? { ...row, page: { ...row.page, ...patch } } : row
  );
}

export function removeRow(rows: DraftRow[], key: string): DraftRow[] {
  return rows.filter((row) => row.key !== key);
}

export function moveRow(
  rows: DraftRow[],
  index: number,
  direction: -1 | 1
): DraftRow[] {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= rows.length) {
    return rows;
  }
  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Dirty is measured against the baseline the draft started from. */
export function isDraftDirty(
  rows: DraftRow[],
  baseline: StarredPage[]
): boolean {
  return JSON.stringify(draftPages(rows)) !== JSON.stringify(baseline);
}

/** What Save writes: trimmed, normalised, de-duplicated. */
export function commitDraft(rows: DraftRow[]): StarredPage[] {
  return sanitizeStarredPages(draftPages(rows));
}
