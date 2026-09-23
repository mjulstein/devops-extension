import { SectionTabs } from '@/sidepanel/atoms/SectionTabs';

export type WorkItemListTab = 'todo' | 'authored' | 'prs' | 'quick';

interface WorkItemListTabsProps {
  activeTab: WorkItemListTab;
  todoCount: number | null;
  authoredCount: number | null;
  pullRequestCount: number | null;
  quickTaskCount: number | null;
  onSelectTab: (tab: WorkItemListTab) => void;
}

export function WorkItemListTabs({
  activeTab,
  todoCount,
  authoredCount,
  pullRequestCount,
  quickTaskCount,
  onSelectTab
}: WorkItemListTabsProps) {
  return (
    <SectionTabs
      label="Work item lists"
      activeTab={activeTab}
      onSelectTab={onSelectTab}
      tabs={[
        { id: 'todo', label: 'TODO', count: todoCount },
        { id: 'authored', label: 'Authored', count: authoredCount },
        { id: 'prs', label: 'PRs', count: pullRequestCount },
        { id: 'quick', label: 'Quick', count: quickTaskCount }
      ]}
    />
  );
}
