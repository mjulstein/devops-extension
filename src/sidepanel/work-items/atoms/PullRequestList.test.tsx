import { renderToStaticMarkup } from 'react-dom/server';
import type { PullRequestActivityItem } from '@/types';
import {
  DEFAULT_PULL_REQUEST_ROW_LIMIT,
  PullRequestList
} from './PullRequestList';

function makePullRequests(count: number): PullRequestActivityItem[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: 100 + index,
    title: `PR number ${index}`,
    url: `https://example.test/pr/${100 + index}`,
    repoName: 'some-repo',
    status: 'active' as const,
    isDraft: false,
    approval: 'no-vote' as const,
    lastActivityAt: 1_756_684_800_000,
    lastCommentedAt: null,
    involvement: {
      authoredByMe: true,
      commentedByMe: false,
      mentionsMe: false,
      assignedToMe: false
    }
  }));
}

function render(count: number) {
  return renderToStaticMarkup(
    <PullRequestList
      items={makePullRequests(count)}
      emptyText="Nothing here."
      linkExternal={true}
    />
  );
}

describe('PullRequestList row limit', () => {
  it('shows every row when the list fits under the limit', () => {
    const markup = render(DEFAULT_PULL_REQUEST_ROW_LIMIT);

    expect(markup).toContain('PR number 19');
    expect(markup).not.toContain('more');
  });

  it('caps a long list at the default limit and offers the rest', () => {
    const markup = render(33);

    expect(markup).toContain('PR number 19');
    expect(markup).not.toContain('PR number 20');
    expect(markup).toContain('Show 13 more');
  });

  it('renders the empty text rather than an empty list', () => {
    expect(render(0)).toContain('Nothing here.');
  });
});
