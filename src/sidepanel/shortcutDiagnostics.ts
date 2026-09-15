// Why the starred-search keyboard shortcut is or is not working.
//
// A `suggested_key` that collides with a browser shortcut is silently left
// unbound: the command exists, has no keys, and pressing anything does nothing,
// with no error in any console the user would think to open. Edge reserves a
// different set of combinations than Chrome, and the operating system can take
// a combination before the browser sees it at all (Windows uses Alt+Shift to
// switch keyboard layout), so what the manifest asks for is not evidence of
// what is bound. Only `chrome.commands.getAll()` is.

/** The command id the manifest declares for the starred-pages search. */
export const STARRED_SEARCH_COMMAND = 'open-starred-search';

export interface ShortcutBinding {
  /** The keys actually bound, or '' when the browser bound none. */
  shortcut: string;
}

export interface ShortcutDiagnosis {
  isBound: boolean;
  text: string;
  /** Where the user fixes it, when there is something to fix. */
  settingsUrl: string | null;
}

const SHORTCUT_SETTINGS_URL = 'edge://extensions/shortcuts';

export function diagnoseShortcut(
  binding: ShortcutBinding | null
): ShortcutDiagnosis {
  if (binding === null) {
    return {
      isBound: false,
      text: 'The browser reports no such command. Reload the extension after a rebuild.',
      settingsUrl: null
    };
  }

  const shortcut = binding.shortcut.trim();
  if (shortcut.length === 0) {
    return {
      isBound: false,
      text: 'No keys are bound — the suggested shortcut clashes with a browser one. Assign your own:',
      settingsUrl: SHORTCUT_SETTINGS_URL
    };
  }

  return {
    isBound: true,
    text: `Bound to ${shortcut}. Change it at:`,
    settingsUrl: SHORTCUT_SETTINGS_URL
  };
}

/**
 * Reads the live binding. Returns null when the command is missing, and when
 * the API is absent (the dev harness), so callers show the same "cannot tell"
 * state either way.
 */
export async function readStarredSearchBinding(): Promise<ShortcutBinding | null> {
  const commands = globalThis.chrome?.commands;
  if (!commands?.getAll) {
    return null;
  }

  const all = await commands.getAll();
  const command = all.find((entry) => entry.name === STARRED_SEARCH_COMMAND);
  return command ? { shortcut: command.shortcut ?? '' } : null;
}

/** Storage key the service worker writes each time the command fires. */
export const SHORTCUT_RUN_KEY = 'lastShortcutRun';

export interface ShortcutRun {
  at: number;
  /** Whether the side panel could be opened from the command handler. */
  opened: boolean;
  /** Whether the surface acknowledged the message. */
  delivered: boolean;
  error: string | null;
  /**
   * Which surface answered: the palette drawn over an Azure DevOps page, or the
   * side panel's own menu. Optional for runs recorded before the palette.
   */
  surface?: 'overlay' | 'panel';
  /**
   * Why the palette was not used, when the page was an Azure DevOps one. The
   * usual answer is that the tab has no content script yet — it was open before
   * the extension was last reloaded — and reloading the tab fixes it.
   */
  paletteError?: string;
}

/**
 * Plain-language account of the last keypress.
 *
 * A bound shortcut that does nothing has three possible culprits — the command
 * never reached the worker, the browser refused to open the panel, or the panel
 * never got the focus message — and they are indistinguishable from the outside.
 * Recording the run makes them distinguishable without opening a console.
 */
export function describeShortcutRun(
  run: ShortcutRun | null,
  now = Date.now()
): string {
  if (run === null) {
    return 'Never pressed since the extension was last reloaded — if pressing it changes nothing here, the keypress is not reaching the extension at all.';
  }

  const ago = formatAgo(now - run.at);
  if (run.paletteError !== undefined) {
    return `Last pressed ${ago}: fell back to the side panel because the palette could not be opened on that page (${run.paletteError}). A tab open since before the extension was last reloaded has no content script until it is refreshed.`;
  }
  if (run.surface === 'overlay' && run.delivered) {
    return `Last pressed ${ago}: opened the palette over the page.`;
  }
  if (run.error !== null) {
    return `Last pressed ${ago}: ${run.error}`;
  }
  if (!run.opened) {
    return `Last pressed ${ago}: the browser refused to open the side panel.`;
  }
  if (!run.delivered) {
    return `Last pressed ${ago}: the panel opened but did not take the focus message.`;
  }
  return `Last pressed ${ago}: worked.`;
}

function formatAgo(ms: number): string {
  if (ms < 0) {
    return 'just now';
  }
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  return `${Math.round(minutes / 60)}h ago`;
}

/** Reads the recorded run; null when nothing has been recorded yet. */
export async function readShortcutRun(): Promise<ShortcutRun | null> {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) {
    return null;
  }
  const stored = await storage.get(SHORTCUT_RUN_KEY);
  const value = stored[SHORTCUT_RUN_KEY] as ShortcutRun | undefined;
  return value ?? null;
}
