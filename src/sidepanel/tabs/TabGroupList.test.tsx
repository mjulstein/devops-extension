import { renderToStaticMarkup } from 'react-dom/server';
import { TabGroupList } from './TabGroupList';
import { buildAppGroups } from '@/sidepanel/tabGroups';
import { readAppFolders } from '@/sidepanel/appGroups';
import {
  groupAdoTabs,
  readAdoTabs,
  toTabGroupNodes
} from '@/sidepanel/adoTabs';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const groups = toTabGroupNodes(
  groupAdoTabs(
    readAdoTabs([
      {
        id: 1,
        url: 'https://dev.azure.com/o/p/_git/repo',
        title: 'repo - Repos',
        favIconUrl: 'https://dev.azure.com/repo.png',
        lastAccessed: now - 3 * DAY
      },
      {
        id: 2,
        url: 'https://dev.azure.com/o/p/_boards/board',
        title: 'Board',
        lastAccessed: now - DAY,
        active: true
      }
    ])
  )
);

function render(props: Partial<Parameters<typeof TabGroupList>[0]> = {}) {
  return renderToStaticMarkup(
    <TabGroupList
      groups={groups}
      onClose={() => undefined}
      onSwitchTo={() => undefined}
      onDuplicate={() => undefined}
      onOpenBookmark={() => undefined}
      onEditBookmark={() => undefined}
      onKeepTab={() => undefined}
      collapsed={new Set()}
      onToggleCollapsed={() => undefined}
      onCleanGroup={() => undefined}
      onOpenGroup={() => undefined}
      onPromoteGroup={() => undefined}
      onMoveGroup={() => undefined}
      daysFor={() => 24}
      onDaysChange={() => undefined}
      {...props}
    />
  );
}

describe('TabGroupList', () => {
  it('says so plainly when nothing is open', () => {
    expect(render({ groups: [] })).toContain(
      'No tabs in these groups are open.'
    );
  });

  it('heads each section and counts it', () => {
    const markup = render();
    expect(markup).toContain('Boards');
    expect(markup).toContain('Repos');
  });

  it('puts the close before the name, which is what it is mostly for', () => {
    const markup = render();
    const close = markup.indexOf('Close repo - Repos');
    const name = markup.indexOf('repo - Repos</span>');
    expect(close).toBeGreaterThan(-1);
    expect(close).toBeLessThan(name);
  });

  it("shows the tab's icon in the close slot, with the ✕ behind it", () => {
    const markup = render();
    const close = markup.indexOf('Close repo - Repos');
    const icon = markup.indexOf('https://dev.azure.com/repo.png', close);
    const name = markup.indexOf('repo - Repos</span>');
    expect(icon).toBeGreaterThan(close);
    expect(icon).toBeLessThan(name);
  });

  it('falls back to a plain ✕ for a tab with no icon', () => {
    const markup = render();
    const close = markup.indexOf('Close Board');
    const name = markup.indexOf('Board</span>', close);
    expect(markup.slice(close, name)).not.toContain('<img');
    expect(markup.slice(close, name)).toContain('✕');
  });

  it('shows how long ago and where, under the name', () => {
    const markup = render();
    expect(markup).toContain('3 days ago');
    expect(markup).toContain('/o/p/_git/repo');
  });

  it('makes the name the control that switches', () => {
    expect(render()).toContain('<button type="button"');
  });

  it('folds each group into a details, open by default', () => {
    const markup = render();
    expect(markup).toContain('<details');
    expect(markup).toContain('open=""');
    expect(markup).toContain('<summary');
  });

  it('draws a group folded when its key is collapsed', () => {
    // Every key, children included: Repos is sectioned per repository, so its
    // sub-groups have keys of their own.
    const keys = (nodes: typeof groups): string[] =>
      nodes.flatMap((node) => [node.key, ...keys(node.children)]);
    const markup = render({ collapsed: new Set(keys(groups)) });
    expect(markup).not.toContain('open=""');
  });

  it('sections the repos group per repository', () => {
    const markup = render();
    expect(markup).toContain('>repo<');
  });

  it('offers no move menu on a group nobody orders', () => {
    // Azure DevOps's own sub-sections are arranged by age. A menu there would
    // be four buttons that do nothing.
    const markup = render();
    expect(markup).toContain('Right-click to move Repos');
    expect(markup).not.toContain('Right-click to move repo');
  });

  it('gives each group a days box and a cleanup button', () => {
    const markup = render();
    expect(markup).toContain('Days untouched before closing a Repos tab');
    expect(markup).toContain('Close Repos tabs untouched for 24 days');
  });

  it('gives the sub-groups their own, so one repo can be cleaned alone', () => {
    expect(render()).toContain('Days untouched before closing a repo tab');
  });

  it('shows the icon of the group newest tab', () => {
    // Repos' newest is tab 1 here, so its icon is the one drawn.
    expect(render()).toContain('repo.png');
  });

  it('marks the tab its window is showing', () => {
    // Clicking a row makes it active; without the mark nothing looks changed.
    expect(render()).toContain('activeTab');
  });

  it('offers the icon as the way to move a group without dragging', () => {
    const markup = render();
    expect(markup).toContain('Right-click to move Repos');
  });

  it('offers to keep a tab only where there is a folder to keep it in', () => {
    // An Azure DevOps section is not a bookmark folder; there is nowhere to
    // put it and a button would be a promise the list cannot keep.
    expect(render()).not.toContain('Keep');
  });
});

describe('TabGroupList keeping a tab', () => {
  const folders = readAppFolders({
    id: 'apps',
    children: [
      {
        id: 'f1',
        title: 'example.com',
        children: [{ id: 'b1', title: 'Home', url: 'https://example.com/' }]
      }
    ]
  });

  const appGroups = buildAppGroups(folders, [
    { id: 9, url: 'https://example.com/report', title: 'Report' },
    { id: 10, url: 'https://example.com/?view=all', title: 'Home again' }
  ]);

  function renderApps() {
    return renderToStaticMarkup(
      <TabGroupList
        groups={appGroups}
        onClose={() => undefined}
        onSwitchTo={() => undefined}
        onDuplicate={() => undefined}
        onOpenBookmark={() => undefined}
        onEditBookmark={() => undefined}
        onKeepTab={() => undefined}
        collapsed={new Set()}
        onToggleCollapsed={() => undefined}
        onCleanGroup={() => undefined}
        onOpenGroup={() => undefined}
        onPromoteGroup={() => undefined}
        onMoveGroup={() => undefined}
        daysFor={() => 24}
        onDaysChange={() => undefined}
      />
    );
  }

  it('offers to keep a tab in the app it is grouped under', () => {
    expect(renderApps()).toContain('Keep Report in example.com');
  });

  it('says a tab is already kept rather than offering again', () => {
    // Same place, different query: a bookmark names a place.
    const markup = renderApps();
    expect(markup).toContain('Kept in example.com');
    expect(markup).not.toContain('Keep Home again');
  });

  describe('an unopened bookmark', () => {
    const withBookmark = [
      {
        key: 'app:example.com',
        label: 'example.com',
        tabs: [],
        children: [],
        bookmarks: [{ id: 'b7', name: 'Docs', url: 'https://example.com/docs' }]
      }
    ];

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("offers to edit it, with the bookmark's icon in the slot", () => {
      vi.stubGlobal('chrome', {
        runtime: { getURL: (path: string) => `chrome-extension://x${path}` }
      });
      const markup = render({ groups: withBookmark });
      const edit = markup.indexOf('Edit Docs in the bookmark manager');
      const name = markup.indexOf('Docs</span>');
      const icon = markup.indexOf('_favicon/', edit);
      expect(edit).toBeGreaterThan(-1);
      expect(icon).toBeGreaterThan(edit);
      expect(icon).toBeLessThan(name);
    });

    it('falls back to a plain ✎ where no icon can be read', () => {
      vi.stubGlobal('chrome', undefined);
      const markup = render({ groups: withBookmark });
      const edit = markup.indexOf('Edit Docs in the bookmark manager');
      const name = markup.indexOf('Docs</span>');
      expect(markup.slice(edit, name)).not.toContain('<img');
      expect(markup.slice(edit, name)).toContain('✎');
    });
  });
});
