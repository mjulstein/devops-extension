// Commands in the favorites search, reached by starting the query with ">".
//
// The search box is already where you go to get somewhere; a few things you
// want while you are there are not places but actions, and giving them their own
// prefix keeps them out of the way of the list you usually want. It is the same
// bargain the "." prefix makes for the browser's bookmarks: the rare case pays
// for itself rather than making the common one longer.
//
// A command is named, not numbered, and Tab completes what you have typed to the
// nearest name — so the names can be long enough to read without being long to
// type.

export const COMMAND_PREFIX = '>';

export interface QuickCommand {
  id: string;
  /** What you type. */
  name: string;
  /** Shown on the row: the name with the arguments it takes. */
  usage: string;
  description: string;
  /** How many words after the name are arguments, for reading them back. */
  argNames: string[];
}

/**
 * The commands, in the order they are offered.
 *
 * All of them act on the tabs you have open, which is the one thing the search
 * box cannot otherwise reach: everything else in the panel is a place to go,
 * and these are things to do with where you already are.
 */
export const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: 'sort-tabs',
    name: 'sort tabs',
    usage: 'sort tabs',
    description:
      'Rearranges the tab bar so tabs of one app sit together. Gathers rather than shuffles: tabs keep their order within a group, and pinned tabs stay where the browser keeps them.',
    argNames: []
  },
  {
    id: 'join-windows',
    name: 'join windows',
    usage: 'join windows',
    description:
      'Moves every tab into the window you are in, leaving the others empty and closed.',
    argNames: []
  },
  {
    id: 'tab-to-window',
    name: 'tab to window',
    usage: 'tab to window',
    description: 'Moves the tab you are on into a window of its own.',
    argNames: []
  },
  {
    id: 'group-to-window',
    name: 'group to window',
    usage: 'group to window <app>',
    description:
      "Moves every tab of one app into a window of its own. Name the app's folder.",
    argNames: ['app']
  },
  {
    id: 'close-older-than',
    name: 'close tabs older than',
    usage: 'close tabs older than <days>',
    description:
      'Closes tabs nobody has looked at for that many days. Asks first, and never a pinned, active or audible one.',
    argNames: ['days']
  }
];

export interface CommandQuery {
  /** What has been typed after the prefix. */
  text: string;
}

/** Whether a query is asking for commands rather than for places. */
export function isCommandQuery(raw: string): boolean {
  return raw.startsWith(COMMAND_PREFIX);
}

export function parseCommandQuery(raw: string): CommandQuery {
  return {
    text: raw.startsWith(COMMAND_PREFIX) ? raw.slice(1).trimStart() : raw
  };
}

/**
 * Commands matching what has been typed, best first.
 *
 * A command matches while the typed text is still growing into its name, and
 * also once the name is complete and arguments are being typed after it — the
 * row has to stay on screen while you fill it in, or there is nothing to press
 * Enter on.
 */
export function matchCommands(
  commands: QuickCommand[],
  text: string
): QuickCommand[] {
  const needle = text.trim().toLowerCase();
  if (needle === '') {
    return commands;
  }

  const scored: {
    command: QuickCommand;
    rank: number;
    tie: number;
    index: number;
  }[] = [];

  commands.forEach((command, index) => {
    const name = command.name.toLowerCase();
    // Still growing into this name. It leads, because "add app e" is somebody
    // part-way through "add app env" — reading it as the complete "add app"
    // with a stray argument would offer the wrong command at every keystroke.
    if (name.startsWith(needle)) {
      scored.push({ command, rank: 0, tie: 0, index });
      return;
    }
    // Name complete, arguments following. The longest name wins, since
    // "add app env x" also begins with "add app".
    if (needle.startsWith(name)) {
      scored.push({ command, rank: 1, tie: -name.length, index });
      return;
    }
    if (name.includes(needle)) {
      scored.push({ command, rank: 2, tie: 0, index });
    }
  });

  return scored
    .sort((a, b) => a.rank - b.rank || a.tie - b.tie || a.index - b.index)
    .map((entry) => entry.command);
}

/**
 * What Tab should complete the typed text to.
 *
 * The nearest name in the list, which is the first match — the same row Enter
 * would act on, so Tab never quietly moves the target. Returns the text
 * unchanged when there is nothing to complete to, and adds a trailing space
 * when the command takes arguments, because the next thing typed is one.
 */
export function completeCommand(
  commands: QuickCommand[],
  text: string
): string {
  const matches = matchCommands(commands, text);
  const best = matches[0];
  if (!best) {
    return text;
  }
  const typed = text.trim().toLowerCase();
  if (typed.startsWith(best.name.toLowerCase())) {
    return text;
  }
  return best.argNames.length > 0 ? `${best.name} ` : best.name;
}

export interface CommandInvocation {
  command: QuickCommand;
  /** The words typed after the command's name, in order. */
  args: string[];
}

/** Reads typed text as a command and its arguments, or null if it names none. */
export function readCommand(
  commands: QuickCommand[],
  text: string
): CommandInvocation | null {
  const trimmed = text.trim();
  const command = matchCommands(commands, trimmed)[0];
  if (!command) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  const name = command.name.toLowerCase();
  const rest = lower.startsWith(name) ? trimmed.slice(command.name.length) : '';

  return {
    command,
    args: rest.split(/\s+/).filter(Boolean)
  };
}
