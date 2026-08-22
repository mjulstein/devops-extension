import clsx from 'clsx';
import classes from './WorkItemListTabs.module.css';

export type WorkItemListTab = 'todo' | 'authored';

interface WorkItemListTabsProps {
  activeTab: WorkItemListTab;
  todoCount: number;
  authoredCount: number | null;
  onSelectTab: (tab: WorkItemListTab) => void;
}

export function WorkItemListTabs({
  activeTab,
  todoCount,
  authoredCount,
  onSelectTab
}: WorkItemListTabsProps) {
  return (
    <div className={classes.tabs} role="tablist">
      <Tab
        label="TODO"
        count={todoCount}
        isActive={activeTab === 'todo'}
        onSelect={() => {
          onSelectTab('todo');
        }}
      />
      <Tab
        label="Authored"
        count={authoredCount}
        isActive={activeTab === 'authored'}
        onSelect={() => {
          onSelectTab('authored');
        }}
      />
    </div>
  );
}

function Tab({
  label,
  count,
  isActive,
  onSelect
}: {
  label: string;
  count: number | null;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={clsx(classes.tab, isActive && classes.tabActive)}
      onClick={onSelect}
    >
      {label}
      {count === null ? null : <span className={classes.count}>{count}</span>}
    </button>
  );
}
