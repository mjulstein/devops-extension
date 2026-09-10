import type { Settings } from '@/types';

// Which settings region owns which field, so the Save control can say where the
// unsaved changes actually are. A settings screen split across tabs otherwise
// hides the fact that something is pending on a tab you are not looking at.

export type SettingsTab =
  | 'connection'
  | 'quick'
  | 'favorites'
  | 'token'
  | 'maintenance';

/** Tabs that own editable settings, in the order the strip shows them. */
export const SAVABLE_SETTINGS_TABS = [
  'connection',
  'quick',
  'favorites'
] as const satisfies readonly SettingsTab[];

export type SavableSettingsTab = (typeof SAVABLE_SETTINGS_TABS)[number];

const FIELDS_BY_TAB: Record<SavableSettingsTab, (keyof Settings)[]> = {
  connection: ['organization', 'project', 'assignedTo', 'todoStates'],
  quick: ['quickTaskParentId', 'quickTaskArchiveId'],
  favorites: ['bookmarkFolderName']
};

export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  connection: 'Project',
  quick: 'Quick',
  favorites: 'Favorites',
  token: 'Token',
  maintenance: 'Tools'
};

function isFieldChanged(
  field: keyof Settings,
  draft: Settings,
  saved: Settings
): boolean {
  const next = draft[field];
  const previous = saved[field];

  if (Array.isArray(next) && Array.isArray(previous)) {
    return (
      next.length !== previous.length ||
      next.some((value, index) => value !== previous[index])
    );
  }

  return next !== previous;
}

/**
 * The tabs whose fields differ from what was last saved.
 *
 * Compare trimmed drafts against the saved settings: saving trims, so a stray
 * trailing space is not a change and must not arm the Save control.
 */
export function findChangedSettingsTabs(
  draft: Settings,
  saved: Settings
): SavableSettingsTab[] {
  return SAVABLE_SETTINGS_TABS.filter((tab) =>
    FIELDS_BY_TAB[tab].some((field) => isFieldChanged(field, draft, saved))
  );
}

/** Tooltip for the Save control, naming where the unsaved changes are. */
export function describeUnsavedSettings(
  changedTabs: SavableSettingsTab[]
): string {
  if (changedTabs.length === 0) {
    return 'No unsaved settings changes.';
  }

  const labels = changedTabs.map((tab) => SETTINGS_TAB_LABELS[tab]);
  return `Save unsaved changes on ${formatList(labels)}.`;
}

function formatList(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
