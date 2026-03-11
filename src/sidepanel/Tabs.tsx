export type SidepanelTabId = 'settings' | 'work-items' | 'create-task';

type TabsProps = {
  activeTab: SidepanelTabId;
  onSelectTab: (tabId: SidepanelTabId) => void;
};

const TAB_ORDER: Array<{ id: SidepanelTabId; label: string }> = [
  { id: 'work-items', label: 'Work items' },
  { id: 'create-task', label: 'Create child tasks' },
  { id: 'settings', label: 'Settings' }
];

export function Tabs({ activeTab, onSelectTab }: TabsProps) {
  return (
    <nav className="tab-row" aria-label="Side panel sections">
      {TAB_ORDER.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-handle ${activeTab === tab.id ? 'active' : ''}`}
          aria-pressed={activeTab === tab.id}
          onClick={() => onSelectTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
