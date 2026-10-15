import { renderToStaticMarkup } from 'react-dom/server';
import { TabGroupList } from './TabGroupList';
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
        lastAccessed: now - DAY
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
      collapsed={new Set()}
      onToggleCollapsed={() => undefined}
      onCleanGroup={() => undefined}
      onOpenGroup={() => undefined}
      onPromoteGroup={() => undefined}
      onReorder={() => undefined}
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

  it('lets a top-level group be dragged, and its children not', () => {
    const markup = render();
    // One draggable per top-level group; the repo sub-group is not one.
    expect(markup.split('draggable="true"').length - 1).toBe(groups.length);
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
});
