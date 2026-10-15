import { Button } from '@/sidepanel/atoms/Button';
import { describeTabAge } from '@/sidepanel/adoTabs';
import {
  groupFavIconUrl as favIconOf,
  type TabGroupNode
} from '@/sidepanel/tabGroups';
import classes from './TabGroupList.module.css';

/**
 * The drag payload's type. Ours alone, so a drag from anywhere else is left
 * for the page to deal with.
 */
export const GROUP_DRAG_TYPE = 'text/x-tab-group-key';

interface TabGroupListProps {
  groups: TabGroupNode[];
  onClose: (id: number) => void;
  onSwitchTo: (id: number, windowId: number | null) => void;
  /** Keys of the groups folded away. */
  collapsed: Set<string>;
  onToggleCollapsed: (key: string) => void;
  /** Closes this group's tabs untouched for that many days. */
  onCleanGroup: (group: TabGroupNode, days: number) => void;
  /** Opens a new tab at a group's own address. */
  onOpenGroup: (url: string) => void;
  /** Makes one of **Other**'s hosts a group of its own. */
  onPromoteGroup: (domain: string) => void;
  /** Moves a configured group to where another one sits. */
  onReorder: (fromKey: string, toKey: string) => void;
  /** The days typed for each group, falling back to the saved threshold. */
  daysFor: (key: string) => number;
  onDaysChange: (key: string, days: string) => void;
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
 *
 * Each group is a `<details>`, so the heading is the control that folds it and
 * the browser handles the disclosure itself. Open or closed is held by the page
 * rather than left to the DOM: the list re-renders on every tab event, and a
 * group that sprang open each time a tab moved would be unusable.
 */
export function TabGroupList({
  groups,
  onClose,
  onSwitchTo,
  collapsed,
  onToggleCollapsed,
  onCleanGroup,
  onOpenGroup,
  onPromoteGroup,
  onReorder,
  daysFor,
  onDaysChange,
  depth = 0
}: TabGroupListProps) {
  if (groups.length === 0) {
    return <p className={classes.empty}>No tabs in these groups are open.</p>;
  }

  return (
    <div className={classes.groups}>
      {groups.map((group) => (
        <details
          key={group.key}
          className={classes.group}
          style={{ paddingInlineStart: depth * 10 }}
          // Only the top level drags: the sub-groups of a narrowed group are in
          // the order its rules are, and the catch-all's are alphabetical, so
          // there is nowhere to record a different one.
          draggable={depth === 0}
          onDragStart={(event) => {
            event.dataTransfer.setData(GROUP_DRAG_TYPE, group.key);
            event.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(event) => {
            if (
              depth === 0 &&
              event.dataTransfer.types.includes(GROUP_DRAG_TYPE)
            ) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }
          }}
          onDrop={(event) => {
            const fromKey = event.dataTransfer.getData(GROUP_DRAG_TYPE);
            if (fromKey !== '' && fromKey !== group.key) {
              event.preventDefault();
              onReorder(fromKey, group.key);
            }
          }}
          open={!collapsed.has(group.key)}
          onToggle={(event) => {
            const isOpen = event.currentTarget.open;
            if (isOpen === collapsed.has(group.key)) {
              onToggleCollapsed(group.key);
            }
          }}
        >
          <summary className={classes.heading}>
            {favIconOf(group) === null ? (
              <span className={classes.icon} aria-hidden="true" />
            ) : (
              <img
                className={classes.icon}
                src={favIconOf(group) ?? ''}
                alt=""
              />
            )}
            {group.label}
            <span className={classes.count}>{countTabs(group)}</span>

            {/* The controls live in the summary so they are beside the group
                they act on, and stop the click there: pressing them should not
                also fold the group away under the hand. */}
            <span
              className={classes.groupActions}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <input
                type="number"
                min={1}
                className={classes.days}
                value={String(daysFor(group.key))}
                aria-label={`Days untouched before closing a ${group.label} tab`}
                onChange={(event) => {
                  onDaysChange(group.key, event.target.value);
                }}
              />
              {group.promoteDomain !== undefined && (
                <Button
                  size="compact"
                  variant="quiet"
                  icon="📌"
                  description={`Make ${group.promoteDomain} a group of its own`}
                  onClick={() => {
                    onPromoteGroup(group.promoteDomain ?? '');
                  }}
                />
              )}
              {group.openUrl !== undefined && (
                <Button
                  size="compact"
                  variant="quiet"
                  icon="＋"
                  description={`Open ${group.openUrl}`}
                  onClick={() => {
                    onOpenGroup(group.openUrl ?? '');
                  }}
                />
              )}
              <Button
                size="compact"
                variant="quiet"
                icon="🧹"
                description={`Close ${group.label} tabs untouched for ${daysFor(group.key)} days`}
                onClick={() => {
                  onCleanGroup(group, daysFor(group.key));
                }}
              />
            </span>
          </summary>

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
              collapsed={collapsed}
              onToggleCollapsed={onToggleCollapsed}
              onCleanGroup={onCleanGroup}
              onOpenGroup={onOpenGroup}
              onPromoteGroup={onPromoteGroup}
              onReorder={onReorder}
              daysFor={daysFor}
              onDaysChange={onDaysChange}
              depth={depth + 1}
            />
          )}
        </details>
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
