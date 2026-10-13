import { renderToStaticMarkup } from 'react-dom/server';
import { AdoTabsList } from './AdoTabsList';
import { groupAdoTabs, readAdoTabs } from '@/sidepanel/adoTabs';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();

const groups = groupAdoTabs(
  readAdoTabs([
    {
      id: 1,
      url: 'https://dev.azure.com/o/p/_git/repo',
      title: 'repo - Repos',
      lastAccessed: now - 3 * DAY
    },
    {
      id: 2,
      url: 'https://dev.azure.com/o/p/_boards/board',
      title: 'Board',
      lastAccessed: now - DAY
    }
  ])
);

function render(props: Partial<Parameters<typeof AdoTabsList>[0]> = {}) {
  return renderToStaticMarkup(
    <AdoTabsList
      groups={groups}
      onClose={() => undefined}
      onSwitchTo={() => undefined}
      {...props}
    />
  );
}

describe('AdoTabsList', () => {
  it('says so plainly when nothing is open', () => {
    expect(render({ groups: [] })).toContain('No Azure DevOps tabs are open.');
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
});
