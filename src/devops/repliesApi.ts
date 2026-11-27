// The calls behind "Replied to you".
//
// Work items: WIQL for the ones the user was mentioned in or active on lately
// (or, for a user override, changed), then each one's comments. Pull requests:
// the same candidate set as the PRs tab, then each one's threads, skipping
// resolved and system threads. Everything through the runtime PAT; a failed
// read drops that thread rather than the list.

import { isObject } from './typeGuards';
import { fetchIdentity } from './identity';
import { queryIds } from './inProgressByMeApi';
import { buildPullRequestWebUrl } from './pullRequests';
import {
  fetchCandidatePullRequests,
  getJson,
  GIT_API_VERSION,
  valuesFrom,
  type RawPullRequest
} from './pullRequestActivity';
import {
  buildRepliesWiql,
  evaluateThread,
  REPLIES_WINDOW_DAYS,
  sortReplies,
  type Reply,
  type ReplyIdentity,
  type ReplyThread,
  type ThreadComment
} from './replies';

const CONCURRENCY = 12;
const MAX_WORK_ITEMS = 200;
/** Thread states that still want something; the rest are resolved. */
const OPEN_THREAD = new Set(['active', 'pending']);

async function mapLimited<T, R>(
  inputs: T[],
  task: (input: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < inputs.length) {
      const input = inputs[next++];
      try {
        results.push(await task(input));
      } catch {
        // One unreadable thread should not take the rest with it.
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toComment(
  author: unknown,
  content: unknown,
  at: unknown
): ThreadComment {
  const who = isObject(author) ? author : {};
  return {
    authorId: text(who.id),
    authorName: text(who.displayName),
    authorUniqueName: text(who.uniqueName),
    content: text(content),
    at: text(at)
  };
}

/** A pull request's open, human threads. */
export function parsePullRequestThreads(
  data: unknown,
  pr: { id: number; title: string; url: string }
): ReplyThread[] {
  const threads: ReplyThread[] = [];
  for (const thread of valuesFrom(data)) {
    if (!isObject(thread) || !OPEN_THREAD.has(text(thread.status))) {
      continue;
    }
    const comments = (Array.isArray(thread.comments) ? thread.comments : [])
      .filter(
        (c): c is Record<string, unknown> =>
          isObject(c) && c.commentType !== 'system' && c.isDeleted !== true
      )
      .map((c) => toComment(c.author, c.content, c.publishedDate));
    threads.push({
      key: `pr:${pr.url}:${String(thread.id)}`,
      // No "!" before the number: a quick task drafted from this must not
      // mention the pull request.
      title: `PR ${String(pr.id)}: ${pr.title}`,
      url: `${pr.url}?_a=overview&discussionId=${String(thread.id)}`,
      comments
    });
  }
  return threads;
}

/** A work item's discussion, as one thread. */
export function parseWorkItemComments(
  data: unknown,
  item: { id: number; title: string; url: string }
): ReplyThread {
  const list =
    isObject(data) && Array.isArray(data.comments) ? data.comments : [];
  return {
    key: `wi:${String(item.id)}`,
    title: item.title,
    url: item.url,
    comments: list
      .filter(
        (c): c is Record<string, unknown> => isObject(c) && c.isDeleted !== true
      )
      .map((c) => toComment(c.createdBy, c.text, c.createdDate))
  };
}

async function workItemThreads(
  organization: string,
  project: string,
  assignedTo: string,
  since: string
): Promise<ReplyThread[]> {
  const ids = (
    await queryIds(
      organization,
      project,
      buildRepliesWiql(assignedTo, since.slice(0, 10))
    )
  ).slice(0, MAX_WORK_ITEMS);
  const org = `https://dev.azure.com/${encodeURIComponent(organization)}`;
  const proj = `${org}/${encodeURIComponent(project)}`;
  const titles = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 200) {
    const batch = await getJson(
      `${org}/_apis/wit/workitems?ids=${ids.slice(i, i + 200).join(',')}` +
        `&fields=System.Title&api-version=7.1`
    );
    for (const entry of valuesFrom(batch)) {
      if (isObject(entry) && isObject(entry.fields)) {
        titles.set(Number(entry.id), text(entry.fields['System.Title']));
      }
    }
  }
  return mapLimited(ids, async (id) =>
    parseWorkItemComments(
      await getJson(
        `${proj}/_apis/wit/workItems/${String(id)}/comments?$top=200&api-version=7.1-preview.4`
      ),
      {
        id,
        title: titles.get(id) ?? `Work item ${String(id)}`,
        url: `${proj}/_workitems/edit/${String(id)}`
      }
    )
  );
}

async function pullRequestThreads(
  organization: string,
  project: string,
  identityId: string,
  since: string
): Promise<ReplyThread[]> {
  const base =
    `https://dev.azure.com/${encodeURIComponent(organization)}/` +
    `${encodeURIComponent(project)}/_apis/git`;
  const { candidates } = await fetchCandidatePullRequests(
    base,
    identityId,
    since
  );
  const lists = await mapLimited(candidates, async (pr: RawPullRequest) => {
    const repoId = pr.repository?.id;
    if (!repoId) {
      return [];
    }
    const data = await getJson(
      `${base}/repositories/${encodeURIComponent(repoId)}/pullRequests/` +
        `${String(pr.pullRequestId)}/threads?api-version=${GIT_API_VERSION}`
    );
    return parsePullRequestThreads(data, {
      id: pr.pullRequestId,
      title: pr.title ?? '',
      url: buildPullRequestWebUrl(
        organization,
        project,
        pr.repository?.name ?? '',
        pr.pullRequestId
      )
    });
  });
  return lists.flat();
}

/** Threads waiting on the subject user, mentions first. Unfiltered by "seen". */
export async function fetchReplies(
  organization: string,
  project: string,
  assignedTo: string,
  now = Date.now()
): Promise<Reply[]> {
  const since = new Date(
    now - REPLIES_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const override = assignedTo.trim();
  const signedIn = await fetchIdentity(organization);
  // An override is known by name only, and its PR candidates by guid only, so
  // its pull request threads are read from the active/updated sets alone.
  const who: ReplyIdentity =
    override === ''
      ? {
          id: signedIn?.id ?? '',
          displayName: signedIn?.displayName ?? '',
          uniqueName: signedIn?.uniqueName ?? ''
        }
      : { id: '', displayName: override, uniqueName: override };
  if (who.id === '' && who.displayName === '') {
    return [];
  }
  const [items, prs] = await Promise.all([
    workItemThreads(organization, project, override, since),
    pullRequestThreads(organization, project, who.id, since)
  ]);
  return sortReplies(
    [...items, ...prs]
      .map((thread) => evaluateThread(thread, who, since))
      .filter((r): r is Reply => r !== null)
  );
}
