import { useEffect, useState } from 'react';
import {
  RECENT_WORK_ITEMS_KEY,
  type RecentWorkItem
} from '@/devops/recentWorkItems';

/**
 * Work items visited lately, as the service worker has recorded them.
 *
 * Kept current rather than read once: the worker writes an entry whenever a
 * work item page is opened, and a panel left open should offer the one you were
 * just looking at.
 */
export function useRecentWorkItems(): RecentWorkItem[] {
  const [items, setItems] = useState<RecentWorkItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const read = (value: unknown) => {
      if (!cancelled && Array.isArray(value)) {
        setItems(value as RecentWorkItem[]);
      }
    };

    void chrome.storage?.local
      ?.get(RECENT_WORK_ITEMS_KEY)
      .then((stored) => read(stored[RECENT_WORK_ITEMS_KEY]))
      .catch(() => undefined);

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>
    ) => {
      if (RECENT_WORK_ITEMS_KEY in changes) {
        read(changes[RECENT_WORK_ITEMS_KEY].newValue);
      }
    };
    chrome.storage?.onChanged?.addListener(onChanged);

    return () => {
      cancelled = true;
      chrome.storage?.onChanged?.removeListener(onChanged);
    };
  }, []);

  return items;
}
