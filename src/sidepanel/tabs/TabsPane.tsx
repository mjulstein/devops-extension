import { TabGroupList } from './TabGroupList';
import type { TabGroupNode } from '@/sidepanel/tabGroups';
import classes from './TabGroupList.module.css';

interface TabsPaneProps {
  groups: TabGroupNode[];
}

/**
 * Every open tab worth grouping, in one place.
 *
 * Azure DevOps's sections and the domains configured on Settings → Tools sit at
 * the same level, because by the time you are looking at this you are asking
 * "what have I got open", not "what kind of thing is it".
 */
export function TabsPane({ groups }: TabsPaneProps) {
  return (
    <div className={classes.pane}>
      <TabGroupList
        groups={groups}
        onClose={(id) => {
          void chrome.tabs.remove(id);
        }}
        onSwitchTo={(id, windowId) => {
          void switchToTab(id, windowId);
        }}
      />
    </div>
  );
}

/**
 * Raises a tab, and its window with it: a tab in a window behind the one in
 * front is activated without being seen otherwise.
 */
async function switchToTab(id: number, windowId: number | null) {
  await chrome.tabs.update(id, { active: true });
  if (windowId !== null) {
    await chrome.windows.update(windowId, { focused: true });
  }
}
