import clsx from 'clsx';
import classes from './Tabs.module.css';

export type SidepanelTabId = 'settings' | 'work-items' | 'work-item';

interface TabsProps {
  activeTab: SidepanelTabId;
  onSelectTab: (tabId: SidepanelTabId) => void;
  isActiveItemPinned: boolean;
  onTogglePinActiveItem: () => void;
  activeItemTabLabel: string;
}

export function Tabs({
  activeTab,
  onSelectTab,
  isActiveItemPinned,
  onTogglePinActiveItem,
  activeItemTabLabel
}: TabsProps) {
  return (
    <nav className={classes.tabRow} aria-label="Side panel sections">
      <button
        type="button"
        className={clsx(
          classes.tabHandle,
          classes.workItemsTabHandle,
          activeTab === 'work-items' && classes.active
        )}
        aria-pressed={activeTab === 'work-items'}
        onClick={() => onSelectTab('work-items')}
      >
        Work items
      </button>

      <div className={classes.tabHandleGroup}>
        <button
          type="button"
          className={clsx(
            classes.tabHandle,
            classes.tabHandleMain,
            activeTab === 'work-item' && classes.active
          )}
          aria-pressed={activeTab === 'work-item'}
          title={activeItemTabLabel}
          onClick={() => onSelectTab('work-item')}
        >
          {activeItemTabLabel}
        </button>
        <button
          type="button"
          className={clsx(classes.tabHandle, classes.tabHandlePin)}
          aria-label={
            isActiveItemPinned
              ? 'Unpin active work item'
              : 'Pin active work item'
          }
          title={
            isActiveItemPinned
              ? 'Unpin active work item'
              : 'Pin active work item'
          }
          onClick={onTogglePinActiveItem}
        >
          {isActiveItemPinned ? 'unpin' : 'pin'}
        </button>
      </div>

      <button
        type="button"
        className={clsx(
          classes.tabHandle,
          classes.tabHandleSettings,
          activeTab === 'settings' && classes.active
        )}
        aria-pressed={activeTab === 'settings'}
        aria-label="Settings"
        title="Settings"
        onClick={() => onSelectTab('settings')}
      >
        ⚙️
      </button>
    </nav>
  );
}
