import {
  buildPullRequestWebUrl,
  deriveApproval,
  extractPullRequestIds,
  selectActivePullRequests,
  toPullRequestRef
} from './pullRequests';
import type { PullRequestRef } from '@/types';

function artifactLink(prId: number, name = 'Pull Request') {
  return {
    rel: 'ArtifactLink',
    url: `vstfs:///Git/PullRequestId/fc1b9c40-3f51-45e4-bbfc-87c04eaed1ee%2fc304691a-356f-4ef2-8157-6d641fb82542%2f${prId}`,
    attributes: { name }
  };
}

describe('extractPullRequestIds', () => {
  it('reads the id out of a pull-request artifact link', () => {
    expect(extractPullRequestIds([artifactLink(41909)])).toEqual([41909]);
  });

  // Azure DevOps returns both casings within a single project.
  it('accepts a lowercase relation name', () => {
    expect(
      extractPullRequestIds([artifactLink(40130, 'pull request')])
    ).toEqual([40130]);
  });

  it('collects every linked pull request, de-duplicated and in order', () => {
    expect(
      extractPullRequestIds([
        artifactLink(40881),
        artifactLink(41828, 'pull request'),
        artifactLink(40881)
      ])
    ).toEqual([40881, 41828]);
  });

  it('ignores non-pull-request artifact links', () => {
    const commit = {
      rel: 'ArtifactLink',
      url: 'vstfs:///Git/Commit/abc%2fdef%2f0123456789',
      attributes: { name: 'Fixed in Commit' }
    };
    expect(extractPullRequestIds([commit])).toEqual([]);
  });

  it('ignores hierarchy relations', () => {
    expect(
      extractPullRequestIds([
        {
          rel: 'System.LinkTypes.Hierarchy-Forward',
          url: 'https://dev.azure.com/o/_apis/wit/workItems/5',
          attributes: { name: 'Child' }
        }
      ])
    ).toEqual([]);
  });

  it('tolerates malformed input', () => {
    expect(extractPullRequestIds(undefined)).toEqual([]);
    expect(extractPullRequestIds('nope')).toEqual([]);
    expect(extractPullRequestIds([null, 42, {}])).toEqual([]);
  });
});

describe('deriveApproval', () => {
  it('reports no vote when nobody has voted', () => {
    expect(deriveApproval([{ vote: 0 }, { vote: 0 }])).toBe('no-vote');
  });

  it('reports approved on a 10 vote', () => {
    expect(deriveApproval([{ vote: 10 }])).toBe('approved');
  });

  it('treats approve-with-suggestions as approved', () => {
    expect(deriveApproval([{ vote: 5 }])).toBe('approved');
  });

  // A blocking reviewer outranks any number of approvals.
  it('reports rejected even alongside approvals', () => {
    expect(deriveApproval([{ vote: 10 }, { vote: -10 }])).toBe('rejected');
  });

  it('reports waiting-for-author over an approval', () => {
    expect(deriveApproval([{ vote: 10 }, { vote: -5 }])).toBe(
      'waiting-for-author'
    );
  });

  it('tolerates malformed reviewers', () => {
    expect(deriveApproval(undefined)).toBe('no-vote');
    expect(deriveApproval([{}, null, { vote: 'yes' }])).toBe('no-vote');
  });
});

describe('buildPullRequestWebUrl', () => {
  it('builds a human-openable URL and encodes segments', () => {
    expect(buildPullRequestWebUrl('my org', 'my proj', 'my repo', 41909)).toBe(
      'https://dev.azure.com/my%20org/my%20proj/_git/my%20repo/pullrequest/41909'
    );
  });
});

describe('toPullRequestRef', () => {
  const raw = {
    pullRequestId: 41909,
    title: 'Add the thing',
    isDraft: false,
    creationDate: '2026-08-20T10:00:00Z',
    repository: { name: 'example-repo' },
    reviewers: [{ vote: 10 }]
  };

  it('shapes a list entry', () => {
    expect(toPullRequestRef(raw, 'org', 'proj')).toEqual({
      id: 41909,
      url: 'https://dev.azure.com/org/proj/_git/example-repo/pullrequest/41909',
      title: 'Add the thing',
      repoName: 'example-repo',
      isDraft: false,
      approval: 'approved',
      createdAt: Date.parse('2026-08-20T10:00:00Z')
    });
  });

  it('falls back to the id when creationDate is unusable', () => {
    const ref = toPullRequestRef(
      { ...raw, creationDate: 'not-a-date' },
      'o',
      'p'
    );
    expect(ref?.createdAt).toBe(41909);
  });

  it('returns null without a pull-request id', () => {
    expect(toPullRequestRef({ title: 'x' }, 'o', 'p')).toBeNull();
    expect(toPullRequestRef(null, 'o', 'p')).toBeNull();
  });
});

describe('selectActivePullRequests', () => {
  function ref(id: number, createdAt: number): PullRequestRef {
    return {
      id,
      url: `https://example.invalid/${id}`,
      title: `PR ${id}`,
      repoName: 'repo',
      isDraft: false,
      approval: 'no-vote',
      createdAt
    };
  }

  it('drops ids that are not open, keeping only active ones', () => {
    const active = new Map([[41828, ref(41828, 200)]]);
    expect(
      selectActivePullRequests([40130, 41828, 40881], active).map((p) => p.id)
    ).toEqual([41828]);
  });

  // Index 0 is the link target, so the oldest still-open PR must come first.
  it('orders oldest first so the first incomplete PR leads', () => {
    const active = new Map([
      [300, ref(300, 300)],
      [100, ref(100, 100)],
      [200, ref(200, 200)]
    ]);
    expect(
      selectActivePullRequests([300, 100, 200], active).map((p) => p.id)
    ).toEqual([100, 200, 300]);
  });

  it('falls back to id order when creation times tie', () => {
    const active = new Map([
      [20, ref(20, 500)],
      [10, ref(10, 500)]
    ]);
    expect(selectActivePullRequests([20, 10], active).map((p) => p.id)).toEqual(
      [10, 20]
    );
  });

  it('returns nothing when no linked PR is open', () => {
    expect(selectActivePullRequests([1, 2], new Map())).toEqual([]);
  });
});
