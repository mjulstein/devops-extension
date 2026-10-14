export interface Settings {
  organization: string;
  project: string;
  assignedTo: string;
  todoStates: string[];
  /**
   * Work item that quick tasks are parented to — a personal catch-all for small
   * jobs that do not belong to real planned work. Stored as text so the field
   * can be empty; empty disables the quick-task button.
   */
  quickTaskParentId: string;
  /**
   * Work item that finished quick tasks are moved under, to keep the Quick list
   * to what is still live. Empty hides the archive action.
   */
  quickTaskArchiveId: string;
  /**
   * How many days a tab may go untouched before the deduplicate button's
   * right-click offers to close it. Stored as text so the field can be cleared,
   * which is how the default is asked for.
   */
  staleTabDays: string;
  /**
   * Domains whose open tabs get a group of their own on the Tabs tab, each
   * optionally narrowed into sub-domains or paths. Azure DevOps is grouped by
   * its own sections and needs no entry here.
   */
  tabGroups: TabGroupSetting[];
  /**
   * Bookmarks folder that favorites are mirrored into, so they also appear in
   * omnibox autocomplete. Empty disables the mirror — the name is the user's to
   * choose and is never assumed.
   */
  bookmarkFolderName: string;
  /**
   * Colour tokens overridden per theme, keyed by custom-property name without
   * the leading dashes. Absent tokens fall through to the defaults in
   * `src/theme.css`, so this holds only what the user actually changed rather
   * than a full copy of the palette that would silently freeze against it.
   */
  themeOverrides: ThemeOverrides;
}

export interface TabGroupRule {
  label: string;
  match: string;
}

export interface TabGroupSetting {
  domain: string;
  label: string;
  rules: TabGroupRule[];
}

export interface ThemeOverrides {
  light: Record<string, string>;
  dark: Record<string, string>;
}

