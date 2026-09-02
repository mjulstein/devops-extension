import {
  isBookmarkSyncPlanEmpty,
  planBookmarkSync,
  type BookmarkNode
} from './bookmarkSync';
import type { StarredPage } from './starredPages';

function favorite(url: string, label: string): StarredPage {
  return { url, label, starredAt: 0 };
}

function node(id: string, title: string, url?: string): BookmarkNode {
  return { id, title, url };
}

describe('planBookmarkSync', () => {
  it('creates bookmarks for new favorites', () => {
    const plan = planBookmarkSync([], [favorite('https://x.invalid/a', 'A')]);
    expect(plan.create).toEqual([{ title: 'A', url: 'https://x.invalid/a' }]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('does nothing when the folder already matches', () => {
    const plan = planBookmarkSync(
      [node('1', 'A', 'https://x.invalid/a')],
      [favorite('https://x.invalid/a', 'A')]
    );
    expect(isBookmarkSyncPlanEmpty(plan)).toBe(true);
  });

  // Matching by url means a rename keeps the same bookmark, not a new one.
  it('retitles in place when a favorite is renamed', () => {
    const plan = planBookmarkSync(
      [node('1', 'Old', 'https://x.invalid/a')],
      [favorite('https://x.invalid/a', 'New')]
    );
    expect(plan.update).toEqual([
      { id: '1', title: 'New', url: 'https://x.invalid/a' }
    ]);
    expect(plan.create).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it('removes bookmarks whose favorite is gone', () => {
    const plan = planBookmarkSync(
      [
        node('1', 'A', 'https://x.invalid/a'),
        node('2', 'B', 'https://x.invalid/b')
      ],
      [favorite('https://x.invalid/a', 'A')]
    );
    expect(plan.remove).toEqual(['2']);
  });

  it('removes duplicate bookmarks for the same url', () => {
    const plan = planBookmarkSync(
      [
        node('1', 'A', 'https://x.invalid/a'),
        node('2', 'A', 'https://x.invalid/a')
      ],
      [favorite('https://x.invalid/a', 'A')]
    );
    expect(plan.remove).toEqual(['2']);
    expect(plan.create).toEqual([]);
  });

  // Something the user put in the folder by hand should survive.
  it('leaves nested folders alone', () => {
    const plan = planBookmarkSync([node('9', 'Subfolder')], []);
    expect(plan.remove).toEqual([]);
  });

  it('handles a mix of create, update and remove', () => {
    const plan = planBookmarkSync(
      [
        node('1', 'Old', 'https://x.invalid/a'),
        node('2', 'Gone', 'https://x.invalid/z')
      ],
      [
        favorite('https://x.invalid/a', 'New'),
        favorite('https://x.invalid/b', 'B')
      ]
    );
    expect(plan.update.map((u) => u.id)).toEqual(['1']);
    expect(plan.create.map((c) => c.url)).toEqual(['https://x.invalid/b']);
    expect(plan.remove).toEqual(['2']);
  });

  it('is empty for no favorites and an empty folder', () => {
    expect(isBookmarkSyncPlanEmpty(planBookmarkSync([], []))).toBe(true);
  });
});
