// Why the starred-search keyboard shortcut is or is not working.
//
// A `suggested_key` that collides with a browser shortcut is silently left
// unbound: the command exists, has no keys, and pressing anything does nothing,
// with no error in any console the user would think to open. Edge reserves a
// different set of combinations than Chrome and does not always apply a
// suggested key for an unpacked extension at all, so what the manifest asks for
// is not evidence of what is bound. Only `chrome.commands.getAll()` is.

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
