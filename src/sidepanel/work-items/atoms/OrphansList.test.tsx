import { renderToStaticMarkup } from 'react-dom/server';
import { OrphansList } from './OrphansList';
import type { OrphanCandidate } from '@/devops/orphanWorkItems';

const items: OrphanCandidate[] = [
  {
    id: 11,
    title: 'A loose bug',
    workItemType: 'Bug',
    state: 'New',
    parentId: null,
    url: 'https://dev.azure.test/o/p/_workitems/edit/11'
  },
  {
    id: 12,
    title: 'A dangling task',
    workItemType: 'Task',
    state: 'Active',
    parentId: null,
    url: 'https://dev.azure.test/o/p/_workitems/edit/12'
  }
];

function render(props: Partial<Parameters<typeof OrphansList>[0]> = {}) {
  return renderToStaticMarkup(
    <OrphansList
      items={items}
      isLoading={false}
      error={null}
      status={null}
      onParent={() => undefined}
      linkExternal={false}
      {...props}
    />
  );
}

describe('OrphansList', () => {
  it('invites a fetch rather than claiming there is nothing', () => {
    // Null is "not asked yet", which is a different thing from "none".
    expect(render({ items: null })).toContain('Click Orphans');
  });

  it('says plainly when nothing is missing a parent', () => {
    expect(render({ items: [] })).toContain('Nothing of yours is missing');
  });

  it('shows each item in the same row every other list uses', () => {
    // Bare id as a link, then type, title and state — the shared WorkItemRow.
    const markup = render();
    expect(markup).toContain('A loose bug');
    expect(markup).toContain('>11</a>');
    expect(markup).toContain('Bug');
    expect(markup).toContain('Active');
  });

  it('offers a checkbox per item and one for the lot', () => {
    const markup = render();
    expect(markup).toContain('Select every work item listed');
    expect(markup).toContain('Select Bug 11');
    expect(markup).toContain('Select Task 12');
  });

  it('keeps the parent button out of reach until there is something to do', () => {
    // Nothing ticked and no id typed: pressing it could only fail.
    expect(render()).toContain('disabled');
  });

  it('links each row to its work item', () => {
    // Through the panel's Link, which reuses a tab already showing it rather
    // than navigating the side panel itself.
    const markup = render();
    expect(markup).toContain(
      'href="https://dev.azure.test/o/p/_workitems/edit/11"'
    );
    expect(markup).toContain(
      'href="https://dev.azure.test/o/p/_workitems/edit/12"'
    );
  });

  it('opens in a new tab when the panel is set to', () => {
    expect(render({ linkExternal: true })).toContain('target="_blank"');
  });

  it('reports what the last attempt did', () => {
    expect(render({ status: 'Parented 2 under #500.' })).toContain(
      'Parented 2 under #500.'
    );
  });

  it('shows a failure instead of an empty list', () => {
    expect(render({ error: 'Reconnect needed' })).toContain('Reconnect needed');
  });
});
