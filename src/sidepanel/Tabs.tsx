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
          className={clsx(
            classes.tabHandle,
            classes.tabHandlePin,
            classes.pinButton,
            isActiveItemPinned
              ? classes.pinButtonPinned
              : classes.pinButtonUnpinned
          )}
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
          <PinIcon isPinned={isActiveItemPinned} className={classes.pinIcon} />
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
interface PinIconProps {
  isPinned: boolean;
  className: string;
}

function PinIcon({ isPinned, className }: PinIconProps) {
  return isPinned ? (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M5 2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.1c0 .5.2 1 .55 1.35l.85.85a.75.75 0 0 1-.53 1.28H9.5v3.35l1.12 1.12a.75.75 0 1 1-1.06 1.06L8 11.06l-1.56 1.56a.75.75 0 1 1-1.06-1.06L6.5 10.44V7.1H4.13A.75.75 0 0 1 3.6 5.82l.85-.85c.35-.35.55-.84.55-1.34V2.5Z" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
    >
      <path d="M5 2.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.1c0 .5.2 1 .55 1.35l.85.85a.75.75 0 0 1-.53 1.28H9.5v3.35l1.12 1.12a.75.75 0 1 1-1.06 1.06L8 11.06l-1.56 1.56a.75.75 0 1 1-1.06-1.06L6.5 10.44V7.1H4.13A.75.75 0 0 1 3.6 5.82l.85-.85c.35-.35.55-.84.55-1.34V2.5Z" />
    </svg>
  );
}
