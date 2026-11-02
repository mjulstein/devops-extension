import { Fragment, useState } from 'react';
import clsx from 'clsx';
import { Button } from '@/sidepanel/atoms/Button';
import { describeTabAge } from '@/sidepanel/adoTabs';
import {
  groupFavIconUrl as favIconOf,
  OTHER_GROUP_KEY,
  type TabGroupNode
} from '@/sidepanel/tabGroups';
import { GroupMoveMenu, type GroupMove } from './GroupMoveMenu';
import classes from './TabGroupList.module.css';

interface TabGroupListProps {
  groups: TabGroupNode[];
  onClose: (id: number) => void;
  onSwitchTo: (id: number, windowId: number | null) => void;
  /** Ctrl- or Cmd-click: a second tab at the same place, left where it is. */
  onDuplicate: (id: number) => void;
  /** Opens a bookmark that has no tab at its address yet. */
  onOpenBookmark: (url: string) => void;
  /** Keys of the groups folded away. */
  collapsed: Set<string>;
  onToggleCollapsed: (key: string) => void;
  /** Closes this group's tabs untouched for that many days. */
  onCleanGroup: (group: TabGroupNode, days: number) => void;
  /** Opens a new tab at a group's own address. */
  onOpenGroup: (url: string) => void;
  /** Makes one of **Other**'s hosts a group of its own. */
  onPromoteGroup: (domain: string) => void;
  /**
   * Moves a group among its siblings from the menu on its icon, given where
   * it sits now. The list this is drawn from is the one that knows the order.
   */
  onMoveGroup: (
    group: TabGroupNode,
    where: GroupMove,
    index: number,
    siblings: TabGroupNode[]
  ) => void;
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
  onDuplicate,
  onOpenBookmark,
  collapsed,
  onToggleCollapsed,
  onCleanGroup,
  onOpenGroup,
  onPromoteGroup,
  onMoveGroup,
  daysFor,
  onDaysChange,
  depth = 0
}: TabGroupListProps) {
  // Which group's move menu is open, by key. One at a time, and held here
  // rather than per row so opening a second closes the first.
  const [menuKey, setMenuKey] = useState<string | null>(null);

  if (groups.length === 0) {
    return <p className={classes.empty}>No tabs in these groups are open.</p>;
  }

  return (
    <div className={classes.groups}>
      {groups.map((group, index) => {
        // Only where the order is somebody's to set. The top level is the
        // stored one, and a sub-group is a bookmark folder. Everything else —
        // Azure DevOps's own sections, the hosts under Other — is arranged by
        // age and host, and a menu offering to move one of those would be four
        // buttons that do nothing.
        const canMove = depth === 0 || group.moveId !== undefined;

        return (
          <Fragment key={group.key}>
            <div
              className={clsx(classes.shell, depth === 0 && classes.shellTop)}
            >
              {canMove && menuKey === group.key && (
                <GroupMoveMenu
                  label={group.label}
                  index={index}
                  count={groups.length}
                  onMove={(where) => {
                    onMoveGroup(group, where, index, groups);
                  }}
                  onClose={() => {
                    setMenuKey(null);
                  }}
                />
              )}
              <details
                key={group.key}
                // The catch-all gets its own ground so it is plain where the
                // groups you defined stop and the leftovers begin.
                className={clsx(
                  classes.group,
                  group.key === OTHER_GROUP_KEY && classes.otherGroup
                )}
                style={{ paddingInlineStart: depth * 10 }}
                open={!collapsed.has(group.key)}
                onToggle={(event) => {
                  const isOpen = event.currentTarget.open;
                  if (isOpen === collapsed.has(group.key)) {
                    onToggleCollapsed(group.key);
                  }
                }}
              >
                <summary className={classes.heading}>
                  <span className={classes.headingRow}>
                    {/* The icon is the one part of the heading with no job of
                      its own, so it is where the move menu lives. */}
                    {favIconOf(group) === null ? (
                      <span
                        className={clsx(
                          classes.icon,
                          canMove && classes.iconMenu
                        )}
                        title={
                          canMove
                            ? `Right-click to move ${group.label}`
                            : undefined
                        }
                        onContextMenu={
                          canMove
                            ? (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setMenuKey(group.key);
                              }
                            : undefined
                        }
                      />
                    ) : (
                      <img
                        className={clsx(
                          classes.icon,
                          canMove && classes.iconMenu
                        )}
                        src={favIconOf(group) ?? ''}
                        alt=""
                        title={
                          canMove
                            ? `Right-click to move ${group.label}`
                            : undefined
                        }
                        onContextMenu={
                          canMove
                            ? (event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setMenuKey(group.key);
                              }
                            : undefined
                        }
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
                          // The one the browser is showing. Clicking a row
                          // makes it so, and without the mark the list gives no
                          // sign that anything happened.
                          className={clsx(
                            classes.name,
                            tab.active && classes.activeTab
                          )}
                          title={tab.url}
                          onClick={(event) => {
                            // Ctrl, or Cmd on a Mac, is the browser's own
                            // convention for "and keep this one" — here that means
                            // a second tab rather than going to the one you have.
                            if (event.ctrlKey || event.metaKey) {
                              onDuplicate(tab.id);
                              return;
                            }
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

                {(group.bookmarks ?? []).length > 0 && (
                  <ul className={classes.list}>
                    {(group.bookmarks ?? []).map((bookmark) => (
                      <li key={bookmark.id} className={classes.row}>
                        {/* No ✕: there is no tab to close. The bookmark is a
                        definition, and removing it is the bookmark manager's
                        job rather than a stray delete on a list of tabs. */}
                        <span
                          className={classes.closePlaceholder}
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          className={clsx(classes.name, classes.unopened)}
                          title={bookmark.url}
                          onClick={() => {
                            onOpenBookmark(bookmark.url);
                          }}
                        >
                          <span className={classes.title}>{bookmark.name}</span>
                          <span className={classes.meta}>
                            not open · {bookmark.url}
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
                    onDuplicate={onDuplicate}
                    onOpenBookmark={onOpenBookmark}
                    collapsed={collapsed}
                    onToggleCollapsed={onToggleCollapsed}
                    onCleanGroup={onCleanGroup}
                    onOpenGroup={onOpenGroup}
                    onPromoteGroup={onPromoteGroup}
                    onMoveGroup={onMoveGroup}
                    daysFor={daysFor}
                    onDaysChange={onDaysChange}
                    depth={depth + 1}
                  />
                )}
              </details>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/** Everything under a group, so a narrowed one still counts what it holds. */
function countTabs(group: TabGroupNode): number {
  return (
    group.tabs.length +
    (group.bookmarks ?? []).length +
    group.children.reduce((total, child) => total + countTabs(child), 0)
  );
}
