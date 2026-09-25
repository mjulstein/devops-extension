// The manager's column widths, remembered per browser.
//
// Kept in localStorage rather than chrome.storage: it is a per-screen
// preference, and the machine with the wide monitor should not push its layout
// onto the laptop. Every access is guarded because storage can be blocked or
// cleared, and a layout preference is never worth failing a render over.

export interface ColumnWidths {
  tree: number;
  issues: number;
}

export const COLUMN_WIDTH_KEY = 'bookmarkManagerColumnWidths';

/** The sizes the page has always had, so nothing moves until it is dragged. */
export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = { tree: 240, issues: 380 };

export const COLUMN_LIMITS = {
  tree: { min: 160, max: 900 },
  issues: { min: 260, max: 1200 }
} as const;

function clampWidths(value: Partial<ColumnWidths>): ColumnWidths {
  const clamp = (n: unknown, key: keyof ColumnWidths) => {
    const limits = COLUMN_LIMITS[key];
    return typeof n === 'number' && Number.isFinite(n)
      ? Math.min(limits.max, Math.max(limits.min, n))
      : DEFAULT_COLUMN_WIDTHS[key];
  };
  return {
    tree: clamp(value.tree, 'tree'),
    issues: clamp(value.issues, 'issues')
  };
}

export function loadColumnWidths(): ColumnWidths {
  try {
    const raw = localStorage.getItem(COLUMN_WIDTH_KEY);
    return raw
      ? clampWidths(JSON.parse(raw) as Partial<ColumnWidths>)
      : DEFAULT_COLUMN_WIDTHS;
  } catch {
    return DEFAULT_COLUMN_WIDTHS;
  }
}

export function saveColumnWidths(widths: ColumnWidths): void {
  try {
    localStorage.setItem(COLUMN_WIDTH_KEY, JSON.stringify(widths));
  } catch {
    // A layout preference that cannot be stored is still a usable layout.
  }
}
