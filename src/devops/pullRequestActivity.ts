import type {
  PullRequestActivityItem,
  PullRequestInvolvement,
  PullRequestStatus
} from '@/types';
import { authFetch } from './authFetch';
import { buildPullRequestWebUrl, deriveApproval } from './pullRequests';
import { fetchIdentity, type DevOpsIdentity } from './identity';

// The PRs tab: pull requests I am currently involved in.
//
// Azure DevOps has no "pull requests I commented on" search — its own UI only
// offers created-by-me and assigned-to-me. Commenting does not reliably add you
// as a reviewer either (measured: of the PRs in a sample I had commented on,
// only 2 of 10 had me as a reviewer), so `searchCriteria.reviewerId` is not a
// usable proxy. Comment authorship has to be read from the threads.
//
// That is affordable if the candidate set is bounded first: active PRs plus PRs
// updated inside the window, then one threads request each, concurrently.
// Measured at 148 candidates: ~2.5s.

const GIT_API_VERSION = '7.0';
// queryTimeRangeType/minTime only exist on the 7.1 preview.
const GIT_API_VERSION_TIME_RANGE = '7.1-preview.1';
const PAGE_SIZE = 500;
const THREAD_CONCURRENCY = 12;

/** How far back "recently" reaches for comments and closed PRs. */
export const ACTIVITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface RawPullRequest {
  pullRequestId: number;
  title?: string;
  status?: string;
  isDraft?: boolean;
  creationDate?: string;
  closedDate?: string;
  reviewers?: unknown;
  repository?: { id?: string; name?: string };
  createdBy?: { id?: string };
}

function toStatus(value: unknown): PullRequestStatus {
  return value === 'completed' || value === 'abandoned' ? value : 'active';
}

/**
 * Decides whether a pull request belongs in the tab, and returns the timestamp
 * it should be ranked by.
 *
 * The rules, in the user's terms: everything I authored that is still open or
 * moved recently; anything I commented on within the window whatever its state;
 * and any *open* PR I have commented on or been mentioned in, however long ago
 * that was — an open PR that mentions me is still my problem.
 */
export function scoreInvolvement(options: {
  status: PullRequestStatus;
  involvement: PullRequestInvolvement;
  createdAt: number;
  closedAt: number | null;
  lastCommentedAt: number | null;
  now: number;
  windowMs?: number;
}): { include: boolean; lastActivityAt: number } {
  const {
    status,
    involvement,
    createdAt,
    closedAt,
    lastCommentedAt,
    now,
    windowMs = ACTIVITY_WINDOW_MS
  } = options;

  const isOpen = status === 'active';
  const cutoff = now - windowMs;
  const commentedRecently =
    lastCommentedAt !== null && lastCommentedAt >= cutoff;
  const movedRecently = closedAt !== null && closedAt >= cutoff;

  const include =
    (involvement.authoredByMe && (isOpen || movedRecently)) ||
    commentedRecently ||
    (isOpen &&
      (involvement.assignedToMe ||
        involvement.commentedByMe ||
        involvement.mentionsMe));

  // Rank by the freshest thing that concerns me, falling back to the PR's own
  // timeline so an untouched authored PR still sorts sensibly.
  const lastActivityAt = Math.max(
    lastCommentedAt ?? 0,
    closedAt ?? 0,
    createdAt
  );

  return { include, lastActivityAt };
}

/**
 * True when the identity is a reviewer on the pull request — Azure DevOps'
 * notion of "assigned to me for review". Read from the `reviewers` array that
 * the PR list already returns, so this costs no extra request.
 */
export function isAssignedTo(reviewers: unknown, identityId: string): boolean {
  if (!Array.isArray(reviewers)) {
    return false;
  }
  return reviewers.some(
    (reviewer) =>
      reviewer &&
      typeof reviewer === 'object' &&
      (reviewer as { id?: unknown }).id === identityId
  );
}

/**
 * True when a comment mentions the given identity. Azure DevOps stores a mention
 * as `@<identity guid>` in the raw content and resolves it for display, but
 * plain `@Display Name` text also occurs, so both are matched.
 */
export function mentionsIdentity(
  content: unknown,
  identity: { id: string; displayName: string }
): boolean {
  if (typeof content !== 'string' || !content.includes('@')) {
    return false;
  }
  if (
    content.includes(`@${identity.id}`) ||
    content.includes(`@<${identity.id}>`)
  ) {
    return true;
  }
  return Boolean(
    identity.displayName && content.includes(`@${identity.displayName}`)
  );
}

async function getJson(url: string): Promise<unknown> {
  try {
    const response = await authFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function valuesFrom(data: unknown): unknown[] {
  if (!data || typeof data !== 'object') {
    return [];
  }
  const value = (data as { value?: unknown }).value;
  return Array.isArray(value) ? value : [];
}

function pullRequestsFrom(data: unknown): RawPullRequest[] {
  return valuesFrom(data) as RawPullRequest[];
}

interface RawComment {
  author?: { id?: string };
  content?: unknown;
  publishedDate?: unknown;
}

function threadsFrom(data: unknown): { comments?: RawComment[] }[] {
  return valuesFrom(data) as { comments?: RawComment[] }[];
}

/**
 * Pull requests I am involved in. Best-effort like the rest of the PR reads: a
 * PAT without `vso.code` yields an empty list rather than an error, so the tab
 * degrades instead of breaking the panel.
 */
export async function fetchPullRequestActivity(
  organization: string,
  project: string,
  now = Date.now()
): Promise<PullRequestActivityItem[]> {
  const identity = await fetchIdentity(organization);
  if (!identity) {
    console.warn(
      '[pullRequestActivity] could not resolve the signed-in identity; PRs tab will be empty.'
    );
    return [];
  }

  const base =
    `https://dev.azure.com/${encodeURIComponent(organization)}/` +
    `${encodeURIComponent(project)}/_apis/git`;
  const since = new Date(now - ACTIVITY_WINDOW_MS).toISOString();

  const [authored, active, updated] = await Promise.all([
    getJson(
      `${base}/pullrequests?searchCriteria.creatorId=${encodeURIComponent(identity.id)}` +
        `&searchCriteria.status=all&$top=${PAGE_SIZE}&api-version=${GIT_API_VERSION}`
    ),
    getJson(
      `${base}/pullrequests?searchCriteria.status=active&$top=${PAGE_SIZE}` +
        `&api-version=${GIT_API_VERSION}`
    ),
    getJson(
      `${base}/pullrequests?searchCriteria.status=all&searchCriteria.queryTimeRangeType=Updated` +
        `&searchCriteria.minTime=${encodeURIComponent(since)}&$top=${PAGE_SIZE}` +
        `&api-version=${GIT_API_VERSION_TIME_RANGE}`
    )
  ]);

  const authoredIds = new Set(
    pullRequestsFrom(authored).map((pr) => pr.pullRequestId)
  );

  const byId = new Map<number, RawPullRequest>();
  for (const pr of [
    ...pullRequestsFrom(authored),
    ...pullRequestsFrom(active),
    ...pullRequestsFrom(updated)
  ]) {
    if (typeof pr.pullRequestId === 'number') {
      byId.set(pr.pullRequestId, pr);
    }
  }

  const candidates = Array.from(byId.values());
  const items: PullRequestActivityItem[] = [];

  for (let index = 0; index < candidates.length; index += THREAD_CONCURRENCY) {
    const batch = candidates.slice(index, index + THREAD_CONCURRENCY);
    const resolved = await Promise.all(
      batch.map((pr) =>
        toActivityItem(
          pr,
          { base, organization, project },
          identity,
          authoredIds,
          now
        )
      )
    );
    for (const item of resolved) {
      if (item) {
        items.push(item);
      }
    }
  }

  // Open PRs first — they are actionable — then most recent activity.
  return items.sort((a, b) => {
    const openness =
      Number(b.status === 'active') - Number(a.status === 'active');
    return openness !== 0 ? openness : b.lastActivityAt - a.lastActivityAt;
  });
}

/**
 * Sort bucket. Lower sorts first.
 *   0 — open and assigned to me for review (someone is waiting on me)
 *   1 — open
 *   2 — closed or abandoned
 */
export function activityRank(item: {
  status: PullRequestStatus;
  involvement: PullRequestInvolvement;
}): number {
  if (item.status !== 'active') {
    return 2;
  }
  return item.involvement.assignedToMe ? 0 : 1;
}

async function toActivityItem(
  pr: RawPullRequest,
  scope: { base: string; organization: string; project: string },
  identity: DevOpsIdentity,
  authoredIds: Set<number>,
  now: number
): Promise<PullRequestActivityItem | null> {
  const { base, organization, project } = scope;
  const repoId = pr.repository?.id;
  let commentedByMe = false;
  let mentionsMe = false;
  let lastCommentedAt: number | null = null;

  if (repoId) {
    const threads = await getJson(
      `${base}/repositories/${encodeURIComponent(repoId)}/pullRequests/${pr.pullRequestId}` +
        `/threads?api-version=${GIT_API_VERSION}`
    );
    for (const thread of threadsFrom(threads)) {
      for (const comment of thread.comments ?? []) {
        if (comment.author?.id === identity.id) {
          commentedByMe = true;
          const at =
            typeof comment.publishedDate === 'string'
              ? Date.parse(comment.publishedDate)
              : NaN;
          if (
            Number.isFinite(at) &&
            (lastCommentedAt === null || at > lastCommentedAt)
          ) {
            lastCommentedAt = at;
          }
        }
        if (mentionsIdentity(comment.content, identity)) {
          mentionsMe = true;
        }
      }
    }
  }

  const status = toStatus(pr.status);
  const createdAt = pr.creationDate ? Date.parse(pr.creationDate) : NaN;
  const closedAt = pr.closedDate ? Date.parse(pr.closedDate) : NaN;

  const involvement: PullRequestInvolvement = {
    authoredByMe: authoredIds.has(pr.pullRequestId),
    commentedByMe,
    mentionsMe,
    assignedToMe: isAssignedTo(pr.reviewers, identity.id)
  };

  const { include, lastActivityAt } = scoreInvolvement({
    status,
    involvement,
    createdAt: Number.isFinite(createdAt) ? createdAt : 0,
    closedAt: Number.isFinite(closedAt) ? closedAt : null,
    lastCommentedAt,
    now
  });

  if (!include) {
    return null;
  }

  const repoName = pr.repository?.name ?? '';

  return {
    id: pr.pullRequestId,
    url: buildPullRequestWebUrl(
      organization,
      project,
      repoName,
      pr.pullRequestId
    ),
    title: pr.title ?? `Pull request ${pr.pullRequestId}`,
    repoName,
    status,
    isDraft: pr.isDraft === true,
    approval: deriveApproval(pr.reviewers),
    lastActivityAt,
    lastCommentedAt,
    involvement
  };
}
