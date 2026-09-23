import type { PullRequestApproval, PullRequestRef } from '@/types';
import { authFetch } from './authFetch';

// Pull-request enrichment for work items. Two independent facts have to be joined:
//
//   1. which PRs a work item links to — only the work item knows, via an
//      `ArtifactLink` relation holding a `vstfs:///Git/PullRequestId/...` URI;
//   2. whether a PR is still open and how it has been voted on — only the Git
//      API knows. The PR list response carries no work-item references, so the
//      join cannot be driven from the PR side.
//
// Reading PRs needs the `vso.code` scope. Everything here is therefore
// best-effort: any failure (a PAT still on the old narrow scope returns 401)
// resolves to "no PR data" so the work-item list renders exactly as before.

const PR_API_VERSION = '7.0';
// Enough to cover a project's open PRs in one request; the endpoint caps anyway.
const ACTIVE_PR_PAGE_SIZE = 500;

/** `vstfs:///Git/PullRequestId/{projectId}%2F{repositoryId}%2F{pullRequestId}` */
const PR_ARTIFACT_PATTERN =
  /^vstfs:\/{3}Git\/PullRequestId\/[^%]+%2f[^%]+%2f(\d+)$/i;

interface RelationLike {
  rel?: unknown;
  url?: unknown;
  attributes?: unknown;
}

/**
 * Extracts pull-request ids from a work item's relations.
 *
 * Azure DevOps is inconsistent about the relation's display name — both
 * `"Pull Request"` and `"pull request"` occur in the same project — and encodes
 * the separators as a lowercase `%2f`, so both are matched case-insensitively.
 */
export function extractPullRequestIds(relations: unknown): number[] {
  if (!Array.isArray(relations)) {
    return [];
  }

  const ids: number[] = [];

  for (const relation of relations as RelationLike[]) {
    if (!relation || typeof relation !== 'object') {
      continue;
    }
    if (relation.rel !== 'ArtifactLink' || typeof relation.url !== 'string') {
      continue;
    }

    const attributes = relation.attributes;
    const name =
      attributes && typeof attributes === 'object'
        ? (attributes as { name?: unknown }).name
        : undefined;

    if (typeof name !== 'string' || name.toLowerCase() !== 'pull request') {
      continue;
    }

    const match = PR_ARTIFACT_PATTERN.exec(relation.url);
    if (!match) {
      continue;
    }

    const id = Number(match[1]);
    if (Number.isInteger(id) && !ids.includes(id)) {
      ids.push(id);
    }
  }

  return ids;
}

/**
 * Collapses reviewer votes into a single review state.
 *
 * A rejection outranks everything: one blocking reviewer means the PR is not
 * going in, however many approvals it has. "Waiting for author" likewise
 * outranks approval, since it is an outstanding request for change.
 */
export function deriveApproval(reviewers: unknown): PullRequestApproval {
  if (!Array.isArray(reviewers)) {
    return 'no-vote';
  }

  const votes = reviewers
    .map((reviewer) =>
      reviewer && typeof reviewer === 'object'
        ? (reviewer as { vote?: unknown }).vote
        : undefined
    )
    .filter((vote): vote is number => typeof vote === 'number');

  if (votes.some((vote) => vote <= -10)) {
    return 'rejected';
  }
  if (votes.some((vote) => vote <= -5)) {
    return 'waiting-for-author';
  }
  if (votes.some((vote) => vote >= 5)) {
    return 'approved';
  }
  return 'no-vote';
}

export function buildPullRequestWebUrl(
  organization: string,
  project: string,
  repoName: string,
  pullRequestId: number
): string {
  return (
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_git/${encodeURIComponent(repoName)}/pullrequest/${pullRequestId}`
  );
}

/** Shapes an entry from the active-PR list response into a `PullRequestRef`. */
export function toPullRequestRef(
  value: unknown,
  organization: string,
  project: string
): PullRequestRef | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const pr = value as Record<string, unknown>;
  const id = pr.pullRequestId;
  if (typeof id !== 'number') {
    return null;
  }

  const repository = pr.repository;
  const repoName =
    repository && typeof repository === 'object'
      ? (repository as { name?: unknown }).name
      : undefined;
  const name = typeof repoName === 'string' ? repoName : '';

  const created =
    typeof pr.creationDate === 'string' ? Date.parse(pr.creationDate) : NaN;

  return {
    id,
    url: buildPullRequestWebUrl(organization, project, name, id),
    title: typeof pr.title === 'string' ? pr.title : `Pull request ${id}`,
    repoName: name,
    isDraft: pr.isDraft === true,
    approval: deriveApproval(pr.reviewers),
    // Fall back to the id, which also increases with creation order.
    createdAt: Number.isFinite(created) ? created : id
  };
}

/**
 * Fetches every active pull request in the project, keyed by id.
 *
 * Returns an empty map rather than throwing: PR data is an enhancement, and a
 * PAT without `vso.code` must not break the work-item list.
 */
export async function fetchActivePullRequests(
  organization: string,
  project: string
): Promise<Map<number, PullRequestRef>> {
  const byId = new Map<number, PullRequestRef>();

  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
    `/_apis/git/pullrequests?searchCriteria.status=active` +
    `&$top=${ACTIVE_PR_PAGE_SIZE}&api-version=${PR_API_VERSION}`;

  try {
    const response = await authFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      console.warn(
        `[pullRequests] active PR fetch failed: HTTP ${response.status}. ` +
          'Work items will show state instead of PR links.'
      );
      return byId;
    }

    const data: unknown = await response.json();
    const values =
      data &&
      typeof data === 'object' &&
      Array.isArray((data as { value?: unknown }).value)
        ? (data as { value: unknown[] }).value
        : [];

    for (const value of values) {
      const ref = toPullRequestRef(value, organization, project);
      if (ref) {
        byId.set(ref.id, ref);
      }
    }
  } catch (error) {
    console.warn(
      '[pullRequests] active PR fetch threw; falling back to work-item state.',
      error
    );
  }

  return byId;
}

/**
 * Picks the item's still-open PRs, **oldest first**, so index 0 is the first
 * incomplete pull request — the one the row links to. A work item can accumulate
 * several PRs over its life; the earliest one still open is the one that is
 * actually holding the item up.
 */
export function selectActivePullRequests(
  pullRequestIds: number[],
  activeById: Map<number, PullRequestRef>
): PullRequestRef[] {
  return pullRequestIds
    .map((id) => activeById.get(id))
    .filter((ref): ref is PullRequestRef => Boolean(ref))
    .sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
}
