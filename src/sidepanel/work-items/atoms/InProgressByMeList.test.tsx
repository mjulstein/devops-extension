import { renderToStaticMarkup } from 'react-dom/server';
import { InProgressByMeList } from './InProgressByMeList';
import type { InProgressByMe } from '@/devops/inProgressByMe';

const data: InProgressByMe = {
  assigned: [
    {
      id: 1,
      title: 'Mine to finish',
      workItemType: 'Task',
      project: 'Proj',
      assignedTo: 'me@example.test',
      url: 'https://dev.azure.test/o/Proj/_workitems/edit/1'
    }
  ],
  startedForOthers: [
    {
      id: 2,
      title: 'Handed over',
      workItemType: 'Bug',
      project: 'Proj',
      assignedTo: 'other@example.test',
      url: 'https://dev.azure.test/o/Proj/_workitems/edit/2'
    }
  ]
};

function render(props: Partial<Parameters<typeof InProgressByMeList>[0]> = {}) {
  return renderToStaticMarkup(
    <InProgressByMeList
      data={data}
      isLoading={false}
      error={null}
      state="In Progress"
      onStateChange={() => undefined}
      onRefresh={() => undefined}
      linkExternal={false}
      {...props}
    />
  );
}

describe('InProgressByMeList', () => {
  it('asks for a state before it will fetch anything', () => {
    const markup = render({ data: null, state: '' });
    expect(markup).toContain('Name the state and press Find.');
    expect(markup).toContain('disabled');
  });

  it('heads both lists with the state that was asked for', () => {
    const markup = render();
    expect(markup).toContain('Assigned to me, In Progress');
    expect(markup).toContain('Moved to In Progress by me, not assigned to me');
  });

  it('names the assignee only where it tells you something', () => {
    const markup = render();
    // Every row of the first list has the same answer, so it is left off.
    expect(markup).not.toContain('(assigned to me@example.test)');
    expect(markup).toContain('(assigned to other@example.test)');
  });

  it('links each row to its own project', () => {
    expect(render()).toContain('/Proj/_workitems/edit/2');
  });

  it('says a list is empty rather than leaving a gap', () => {
    const markup = render({ data: { assigned: [], startedForOthers: [] } });
    expect(markup).toContain('Nothing here.');
  });

  it('shows a failure instead of a blank list', () => {
    expect(render({ error: 'WIQL failed' })).toContain('WIQL failed');
  });
});
