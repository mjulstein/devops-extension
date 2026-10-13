import { Button } from '@/sidepanel/atoms/Button';
import { describeTabAge } from '@/sidepanel/adoTabs';
import type { TabGroupNode } from '@/sidepanel/tabGroups';
import classes from './TabGroupList.module.css';

interface TabGroupListProps {
  groups: TabGroupNode[];
  onClose: (id: number) => void;
  onSwitchTo: (id: number, windowId: number | null) => void;
  /** How deep this list is drawn, for the indent. */
  depth?: number;
}

/**
 * Open tabs, grouped, to close or go back to.
 *
 * The close sits on the left, before the name, because closing is what this
 * list is mostly for and reaching past the title to find an x at the end of a
 * ragged row is the slower half of doing it. The name is the control that
 * switches: the thing you read is the thing you press.
 *
 * It draws its own children, so a group narrowed into sub-groups and one that
 * was never narrowed are the same component with the same rows.
 */
export function TabGroupList({
  groups,
  onClose,
  onSwitchTo,
  depth = 0
}: TabGroupListProps) {
  if (groups.length === 0) {
    return <p className={classes.empty}>No tabs in these groups are open.</p>;
  }

  return (
    <div className={classes.groups}>
      {groups.map((group) => (
        <section key={group.key} style={{ paddingInlineStart: depth * 10 }}>
          <h4 className={classes.heading}>
            {group.label}
            <span className={classes.count}>{countTabs(group)}</span>
          </h4>

          {group.tabs.length > 0 && (
            <ul className={classes.list}>
              {group.tabs.map((tab) => (
                <li key={tab.id} className={classes.row}>
                  <Button
                    size="compact"
                    variant="quiet"
                    icon="✕"
                    description={`Close ${tab.title}`}
                    onClick={() => {
                      onClose(tab.id);
                    }}
                  />
                  <button
                    type="button"
                    className={classes.name}
                    title={tab.url}
                    onClick={() => {
                      onSwitchTo(tab.id, tab.windowId);
                    }}
                  >
                    <span className={classes.title}>{tab.title}</span>
                    <span className={classes.meta}>
                      {describeTabAge(tab)} · {tab.path}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {group.children.length > 0 && (
            <TabGroupList
              groups={group.children}
              onClose={onClose}
              onSwitchTo={onSwitchTo}
              depth={depth + 1}
            />
          )}
        </section>
      ))}
    </div>
  );
}

/** Everything under a group, so a narrowed one still counts what it holds. */
function countTabs(group: TabGroupNode): number {
  return (
    group.tabs.length +
    group.children.reduce((total, child) => total + countTabs(child), 0)
  );
}
