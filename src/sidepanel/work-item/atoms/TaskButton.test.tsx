import { renderToStaticMarkup } from 'react-dom/server';
import { TaskButton } from './TaskButton';

describe('TaskButton', () => {
  it('renders a compact task label while preserving state metadata', () => {
    const markup = renderToStaticMarkup(
      <TaskButton
        task={{
          id: 42,
          title: 'Ship the atomized card layout',
          state: 'Done',
          url: 'https://example.test/task/42',
          parentId: 10
        }}
        isSelected={false}
        onSelectTask={vi.fn().mockResolvedValue(undefined)}
      />
    );
    const visibleLabel = />([^<]+)<\/button>$/.exec(markup)?.[1];
    expect(visibleLabel).toBe('#42 - Ship the atomized card layout');
    expect(markup).toContain(
      'title="#42 [Done] - Ship the atomized card layout"'
    );
    expect(markup).toContain('data-state-tone="done"');
  });

  it('marks selected todo tasks with the todo tone metadata', () => {
    const markup = renderToStaticMarkup(
      <TaskButton
        task={{
          id: 7,
          title: 'Keep To Do blue',
          state: 'To Do',
          url: 'https://example.test/task/7',
          parentId: 3
        }}
        isSelected={true}
        onSelectTask={vi.fn().mockResolvedValue(undefined)}
      />
    );
    expect(markup).toContain('data-state-tone="todo"');
    expect(markup).toContain('aria-label="Task #7, To Do: Keep To Do blue"');
  });
});
