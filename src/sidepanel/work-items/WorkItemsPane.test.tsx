import { renderToStaticMarkup } from 'react-dom/server';
import type { WorkItem } from '@/types';
import { WorkItemsPane } from './WorkItemsPane';

function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 501,
    workItemType: 'Task',
    title: 'Keep the rows on screen while refreshing',
    state: 'In Progress',
    assignedTo: 'Someone',
    parentId: null,
    parent: null,
    closedDate: null,
    lastChangedDate: null,
    url: 'https://example.test/_workitems/edit/501',
    ...overrides
  };
}

function renderPane(overrides: Record<string, unknown> = {}) {
  const noop = () => undefined;
  const asyncNoop = () => Promise.resolve();

  return renderToStaticMarkup(
    <WorkItemsPane
      loadingMessage="Fetching work items..."
      isLoading={false}
      result={{
        count: 1,
        openItems: [makeWorkItem({ id: 1, title: 'An open item' })],
        closedItems: [],
        closedDateRange: { start: '2026-09-01', end: '2026-09-07' }
      }}
      closedDateRange={{ start: '2026-09-01', end: '2026-09-07' }}
      isClosedEndTodayShortcut={true}
      showWorkItemParentDetails={false}
      statusMessage={null}
      preFetchHint={null}
      onCreateQuickTask={asyncNoop}
      canCreateQuickTask={true}
      onClosedDateRangeChange={asyncNoop}
      onEnableCustomClosedEndDate={noop}
      onResetClosedDateRange={asyncNoop}
      onRefetchClosedDay={asyncNoop}
      onToggleShowWorkItemParentDetails={asyncNoop}
      isActionDisabled={false}
      linkExternal={true}
      activeListTab="quick"
      onSelectListTab={noop}
      authoredItems={null}
      isAuthoredLoading={false}
      authoredError={null}
      closedParentRollup={null}
      isClosedRollupLoading={false}
      closedRollupError={null}
      pullRequests={null}
      isPullRequestsLoading={false}
      pullRequestsError={null}
      quickTasks={[makeWorkItem()]}
      isQuickTasksLoading={false}
      quickTasksError={null}
      pinnedQuickTaskIds={[]}
      quickTaskParentId={7}
      quickTaskTitle=""
      onQuickTaskTitleChange={noop}
      onCreateQuickTaskFromTitle={asyncNoop}
      onTogglePinQuickTask={asyncNoop}
      quickTaskArchiveId={null}
      onArchiveQuickTask={asyncNoop}
      createdQuickTask={null}
      onOpenCreatedQuickTask={asyncNoop}
      onDismissCreatedQuickTask={noop}
      onDismissStatusMessage={noop}
      {...overrides}
    />
  );
}

describe('WorkItemsPane loading behaviour', () => {
  it('keeps quick-task rows on screen while the list refreshes', () => {
    const markup = renderPane({ isQuickTasksLoading: true });

    expect(markup).toContain('Keep the rows on screen while refreshing');
    expect(markup).not.toContain('Loading quick tasks');
    expect(markup).toContain('refreshing');
  });

  it('shows a placeholder only when the list has never loaded', () => {
    const markup = renderPane({
      quickTasks: null,
      isQuickTasksLoading: true
    });

    expect(markup).toContain('Loading quick tasks');
  });

  it('still shows an error alongside the rows it already had', () => {
    const markup = renderPane({ quickTasksError: 'PAT expired' });

    expect(markup).toContain('PAT expired');
    expect(markup).toContain('Keep the rows on screen while refreshing');
  });

  it('renders a terse clickable notice for a freshly created task', () => {
    const markup = renderPane({
      createdQuickTask: { id: 9001, url: 'https://example.test/9001' }
    });

    expect(markup).toContain('Created #9001');
    expect(markup).toContain('Open the new task in a new tab');
  });

  it('renders no created notice when nothing was just created', () => {
    expect(renderPane()).not.toContain('Created #');
  });
});

describe('WorkItemsPane TODO hierarchy', () => {
  const parent = makeWorkItem({
    id: 400,
    workItemType: 'Improvement',
    title: 'Parent carrying the context',
    state: 'To Do'
  });
  const startedTask = makeWorkItem({
    id: 401,
    workItemType: 'Task',
    title: 'Task already under way',
    state: 'In Progress',
    parentId: 400
  });

  function renderTodo(overrides: Record<string, unknown> = {}) {
    return renderPane({
      activeListTab: 'todo',
      result: {
        count: 2,
        openItems: [parent, startedTask],
        closedItems: [],
        closedDateRange: { start: '2026-09-01', end: '2026-09-07' }
      },
      ...overrides
    });
  }

  it('hides a parent whose task is already in progress', () => {
    const markup = renderTodo();

    expect(markup).toContain('Task already under way');
    expect(markup).not.toContain('Parent carrying the context');
  });

  it('keeps the parent once nothing under it has started', () => {
    const queued = { ...startedTask, state: 'To Do' };
    const markup = renderTodo({
      result: {
        count: 2,
        openItems: [parent, queued],
        closedItems: [],
        closedDateRange: { start: '2026-09-01', end: '2026-09-07' }
      }
    });

    expect(markup).toContain('Parent carrying the context');
  });

  it('leaves the grouped view showing both, since the parent is the heading', () => {
    const markup = renderTodo({ showWorkItemParentDetails: true });

    expect(markup).toContain('Parent carrying the context');
    expect(markup).toContain('Task already under way');
  });
});

describe('WorkItemsPane Authored split', () => {
  const started = makeWorkItem({
    id: 500,
    workItemType: 'Bug',
    title: 'Someone picked this up',
    state: 'In Progress'
  });
  const queued = makeWorkItem({
    id: 501,
    workItemType: 'Bug',
    title: 'Still waiting for anyone',
    state: 'To Do'
  });

  function renderAuthored(items: unknown[]) {
    return renderPane({ activeListTab: 'authored', authoredItems: items });
  }

  it('keeps started items in the main list and the rest in an accordion', () => {
    const markup = renderAuthored([started, queued]);

    expect(markup).toContain('Someone picked this up');
    expect(markup).toContain('Still waiting for anyone');
    expect(markup).toContain('Not started (1)');
    expect(markup).toContain('<details');
  });

  it('renders no accordion when everything is under way', () => {
    const markup = renderAuthored([started]);

    expect(markup).not.toContain('Not started');
    expect(markup).not.toContain('<details');
  });

  it('says why the main list is empty when everything is dormant', () => {
    const markup = renderAuthored([queued]);

    expect(markup).toContain('Nothing you authored is being worked on yet.');
    expect(markup).toContain('Not started (1)');
  });

  it('applies the parent rule to authored items too', () => {
    const parent = makeWorkItem({
      id: 600,
      workItemType: 'Improvement',
      title: 'Authored parent',
      state: 'To Do'
    });
    const child = makeWorkItem({
      id: 601,
      workItemType: 'Task',
      title: 'Authored child under way',
      state: 'In Progress',
      parentId: 600
    });

    const markup = renderAuthored([parent, child]);

    expect(markup).toContain('Authored child under way');
    expect(markup).not.toContain('Authored parent');
  });
});

describe('WorkItemsPane chrome', () => {
  it('offers no fetch button, since selecting a tab refetches', () => {
    expect(renderPane()).not.toContain('Fetch work items');
  });

  it('keeps the tab strip reachable before the first fetch', () => {
    const markup = renderPane({ result: null, activeListTab: 'todo' });

    expect(markup).toContain('TODO');
    expect(markup).toContain('Click TODO to load your work items.');
  });

  it('gives the status message a dismiss control under the tabs', () => {
    const markup = renderPane({
      statusMessage: { kind: 'success', text: 'Fetched 12 work item(s).' }
    });

    expect(markup).toContain('Fetched 12 work item(s).');
    expect(markup).toContain('aria-label="Dismiss this message"');
  });
});
