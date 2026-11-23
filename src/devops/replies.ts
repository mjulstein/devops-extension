// "Replied to you": discussion threads where somebody wrote after the user's
// last word, or mentioned the user and got no answer.
//
// Pure. The calls live in `repliesApi.ts`. A thread is anything with a list of
// comments: a pull request thread, or a work item's whole discussion.

/** How far back a reply counts, independent of the day on screen. */
export const REPLIES_WINDOW_DAYS = 14;

export interface ReplyIdentity {
  /** Identity GUID; empty when only a name is known (a user override). */
  id: string;
  displayName: string;
  uniqueName: string;
}

export interface ThreadComment {
  authorId: string;
  authorName: string;
  authorUniqueName: string;
  /** Raw content: markdown for PRs, HTML for work items. */
  content: string;
  /** ISO timestamp. */
  at: string;
}

export interface ReplyThread {
  /** Stable key for "seen": `pr:<repo>:<pr>:<thread>` or `wi:<id>`. */
  key: string;
  /** What the thread belongs to, as the row's title. */
  title: string;
  url: string;
  comments: ThreadComment[];
}

export interface Reply {
  key: string;
  title: string;
  url: string;
  lastAuthor: string;
  lastAt: string;
  excerpt: string;
  /** Someone mentioned the user and the user has not written since. */
  mention: boolean;
}

function same(a: string, b: string): boolean {
  return a.trim() !== '' && a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function isAuthor(comment: ThreadComment, who: ReplyIdentity): boolean {
  if (who.id !== '' && comment.authorId === who.id) {
    return true;
  }
  return (
    same(comment.authorUniqueName, who.uniqueName) ||
    same(comment.authorName, who.displayName) ||
    same(comment.authorUniqueName, who.displayName)
  );
}

/**
 * True when content mentions the user: `@<guid>` in PR markdown, the guid in a
 * work item's `data-vss-mention` attribute, or a plain `@Display Name`.
 */
export function mentions(content: string, who: ReplyIdentity): boolean {
  if (who.id !== '' && content.includes(who.id)) {
    return true;
  }
  return (
    who.displayName.trim() !== '' && content.includes(`@${who.displayName}`)
  );
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' '
};

/** The first non-empty line of a comment, as plain text. */
export function excerpt(content: string, max = 140): string {
  const text = content
    // A PR mention is `@<guid>`; replace it before tags are stripped.
    .replace(/@<[0-9a-z-]+>/gi, '@someone')
    .replace(/<br\s*\/?>|<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e);
  const line =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l !== '') ?? '';
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/** The reply a thread holds for the user, if any, at or after `since`. */
export function evaluateThread(
  thread: ReplyThread,
  who: ReplyIdentity,
  since: string
): Reply | null {
  const comments = thread.comments
    .filter((c) => c.at !== '')
    .sort((a, b) => (a.at < b.at ? -1 : 1));
  if (comments.length === 0) {
    return null;
  }
  const last = comments[comments.length - 1];
  if (isAuthor(last, who) || last.at < since) {
    return null;
  }
  let mine = -1;
  comments.forEach((c, index) => {
    if (isAuthor(c, who)) {
      mine = index;
    }
  });
  const after = comments.slice(mine + 1);
  const mention = after.some((c) => mentions(c.content, who));
  if (mine === -1 && !mention) {
    return null;
  }
  return {
    key: thread.key,
    title: thread.title,
    url: thread.url,
    lastAuthor: last.authorName,
    lastAt: last.at,
    excerpt: excerpt(last.content),
    mention
  };
}

/** Mentions first, then newest. */
export function sortReplies(replies: Reply[]): Reply[] {
  return [...replies].sort((a, b) =>
    a.mention !== b.mention
      ? a.mention
        ? -1
        : 1
      : a.lastAt < b.lastAt
        ? 1
        : -1
  );
}

/** Seen marks: thread key → the `lastAt` that was seen. */
export type SeenMarks = Record<string, string>;

/** Hides what was marked seen, until something newer arrives. */
export function unseen(replies: Reply[], seen: SeenMarks): Reply[] {
  return replies.filter((r) => !(seen[r.key] && seen[r.key] >= r.lastAt));
}

/** Drops marks too old to hide anything any more. */
export function pruneSeen(seen: SeenMarks, since: string): SeenMarks {
  return Object.fromEntries(
    Object.entries(seen).filter(([, at]) => at >= since)
  );
}

/** Work items worth reading the discussion of. */
export function buildRepliesWiql(assignedTo: string, since: string): string {
  const user = assignedTo.trim();
  const who =
    user === ''
      ? '([System.Id] IN (@RecentMentions) OR [System.Id] IN (@MyRecentActivity))'
      : `[System.ChangedBy] EVER '${user.replace(/'/g, "''")}'`;
  return `SELECT [System.Id] FROM WorkItems WHERE ${who} AND [System.ChangedDate] >= '${since}'`;
}
