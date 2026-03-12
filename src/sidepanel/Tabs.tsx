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
    <nav className="tab-row" aria-label="Side panel sections">
      <button
        type="button"
        className={`tab-handle ${activeTab === 'work-items' ? 'active' : ''}`}
        aria-pressed={activeTab === 'work-items'}
        onClick={() => onSelectTab('work-items')}
      >
        Work items
      </button>

      <div
        className={`tab-handle-group ${activeTab === 'work-item' ? 'active' : ''}`}
      >
        <button
          type="button"
          className={`tab-handle tab-handle-main ${activeTab === 'work-item' ? 'active' : ''}`}
          aria-pressed={activeTab === 'work-item'}
          title={activeItemTabLabel}
          onClick={() => onSelectTab('work-item')}
        >
          {activeItemTabLabel}
        </button>
        <button
          type="button"
          className="tab-handle tab-handle-pin"
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
        className={`tab-handle tab-handle-settings ${activeTab === 'settings' ? 'active' : ''}`}
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
