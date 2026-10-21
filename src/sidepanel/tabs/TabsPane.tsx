import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/sidepanel/atoms/Button';
import {
  allTabsIn,
  moveKeyTo,
  sortTabGroups,
  type TabGroupNode,
  type TabOrder
} from '@/sidepanel/tabGroups';
import { resolveStaleTabDays, selectStaleTabs } from '@/sidepanel/staleTabs';
import { TabGroupList } from './TabGroupList';
import { bookmarkMoveFor, gapForMove } from './moveGroup';
import type { GroupMove } from './GroupMoveMenu';
import classes from './TabGroupList.module.css';

const ORDER_KEY = 'tabGroupOrder';

interface TabsPaneProps {
  groups: TabGroupNode[];
  /** The saved threshold, which each group's days box starts from. */
  staleTabDays: number;
  /** Adds a host from **Other** to the configured groups, and saves. */
  onPromoteGroup: (domain: string) => void;
  /** Records the order left by dropping a group into the gap at this index. */
  onReorderGroups: (keys: string[]) => void;
}

/**
 * Every open tab worth grouping, in one place.
 *
 * Azure DevOps's sections and the domains configured on Settings → Tools sit at
 * the same level, because by the time you are looking at this you are asking
 * "what have I got open", not "what kind of thing is it".
 */
export function TabsPane({
  groups,
  staleTabDays,
  onPromoteGroup,
  onReorderGroups
}: TabsPaneProps) {
  const [order, setOrder] = useTabOrder();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // Per group, and only while the panel is open: it is a number you reach for
  // when tidying one section, not a preference about it.
  const [days, setDays] = useState<Record<string, string>>({});
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  const ordered = sortTabGroups(groups, order);

  const daysFor = useCallback(
    (key: string) => resolveStaleTabDays(days[key] ?? String(staleTabDays)),
    [days, staleTabDays]
  );

  const cleanGroup = useCallback((group: TabGroupNode, forDays: number) => {
    const ids = selectStaleTabs(allTabsIn(group), Date.now(), forDays);
    if (ids.length === 0) {
      window.alert(
        `Nothing in ${group.label} has gone ${forDays} days untouched.`
      );
      return;
    }
    if (
      window.confirm(
        `Close ${ids.length} ${group.label} tab${ids.length === 1 ? '' : 's'} untouched for ${forDays} days or more?`
      )
    ) {
      void chrome.tabs.remove(ids);
    }
  }, []);

  /**
   * A move from the menu on a group's icon.
   *
   * A top-level group is ours to order and moves in the stored key order. A
   * sub-group is a bookmark folder, and the folder's own order is what the
   * panel reads back, so moving it is moving the folder — there is no second
   * list that could disagree.
   */
  const moveGroup = useCallback(
    (
      group: TabGroupNode,
      where: GroupMove,
      index: number,
      siblings: TabGroupNode[]
    ) => {
      if (group.moveId === undefined || group.moveParentId === undefined) {
        onReorderGroups(
          moveKeyTo(
            siblings.map((entry) => entry.key),
            group.key,
            gapForMove(where, index, siblings.length)
          )
        );
        return;
      }

      const move = bookmarkMoveFor(
        where,
        index,
        siblings.map((entry) => entry.moveId ?? '')
      );
      if (move !== null) {
        void chrome.bookmarks?.move(move.id, {
          parentId: group.moveParentId,
          index: move.index
        });
      }
    },
    [onReorderGroups]
  );

  const toggleCollapsed = useCallback((key: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }, []);

  return (
    <div className={classes.pane}>
      <div className={classes.orderRow}>
        <Button
          size="compact"
          variant="quiet"
          icon={order === 'oldest' ? '↓' : '↑'}
          onClick={() => {
            setOrder(order === 'oldest' ? 'newest' : 'oldest');
          }}
        >
          {order === 'oldest' ? 'Oldest first' : 'Newest first'}
        </Button>
      </div>

      <TabGroupList
        groups={ordered}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        onCleanGroup={cleanGroup}
        onOpenGroup={(url) => {
          void chrome.tabs.create({ url });
        }}
        onPromoteGroup={onPromoteGroup}
        draggingKey={draggingKey}
        onDragStateChange={setDraggingKey}
        onMoveGroup={moveGroup}
        onReorder={(fromKey, gapIndex) => {
          onReorderGroups(
            moveKeyTo(
              ordered.map((group) => group.key),
              fromKey,
              gapIndex
            )
          );
        }}
        daysFor={daysFor}
        onDaysChange={(key, value) => {
          setDays((current) => ({ ...current, [key]: value }));
        }}
        onClose={(id) => {
          void chrome.tabs.remove(id);
        }}
        onSwitchTo={(id, windowId) => {
          void switchToTab(id, windowId);
        }}
        onDuplicate={(id) => {
          void chrome.tabs.duplicate(id);
        }}
        onOpenBookmark={(url) => {
          void chrome.tabs.create({ url });
        }}
      />
    </div>
  );
}

/**
 * Which way round the lists are ordered, remembered browser-locally.
 *
 * A view preference, not a setting: it belongs to this machine's panel and
 * syncing it would say nothing useful on another one. Remembered because one
 * that reset every time the panel opened would have to be set every time.
 */
function useTabOrder(): [TabOrder, (order: TabOrder) => void] {
  const [order, setOrder] = useState<TabOrder>('oldest');

  useEffect(() => {
    void chrome.storage?.local
      ?.get(ORDER_KEY)
      .then((stored) => {
        if (stored[ORDER_KEY] === 'newest' || stored[ORDER_KEY] === 'oldest') {
          setOrder(stored[ORDER_KEY]);
        }
      })
      .catch(() => undefined);
  }, []);

  const chooseOrder = useCallback((next: TabOrder) => {
    setOrder(next);
    void chrome.storage?.local
      ?.set({ [ORDER_KEY]: next })
      .catch(() => undefined);
  }, []);

  return [order, chooseOrder];
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
