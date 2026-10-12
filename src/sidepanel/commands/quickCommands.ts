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
 * Both of these fill the apps list, which is the part of the search that cannot
 * fill itself: a favorite is starred from the page it is on, but an app is a
 * family of addresses and there is nowhere else to say so.
 */
export const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: 'add-app',
    name: 'add app',
    usage: 'add app [name]',
    description:
      'Add the page you are on to its app. Files it under the app folder whose name the address contains, or starts one named from the address.',
    argNames: ['name']
  },
  {
    id: 'add-app-env',
    name: 'add app env',
    usage: 'add app env <env> [url]',
    description:
      'The same, with the environment named rather than read off the address. Uses the page you are on when you give no address.',
    argNames: ['env', 'url']
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
