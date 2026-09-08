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
      onFetchWorkItems={asyncNoop}
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
