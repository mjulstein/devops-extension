import { useCallback, useEffect, useState } from 'react';
import { stripMentions } from '@/devops/quickTask';
import type { Settings, WorkItem } from '@/types';
import {
  loadPinnedQuickTaskIds,
  loadWorkItemsClosedDateRange,
  savePinnedQuickTaskIds
} from '@/sidepanel/chromeStorage';
import { fetchQuickTasks } from '@/sidepanel/tabMessaging/fetchQuickTasks';
import { createQuickTask } from '@/sidepanel/tabMessaging/createQuickTask';
import { archiveQuickTask } from '@/sidepanel/tabMessaging/archiveQuickTask';
import {
  sortQuickTasks,
  togglePinnedId
} from '@/sidepanel/work-items/atoms/quickTaskSorting';

function positiveId(value: string): number | null {
  const id = Number(value.trim());
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Feeds the side panel's own `QuickTaskList` on the dashboard.
 *
 * The same messages and the same pinned ids as the panel, so the two show one
 * list. The bookmark mirror is left to the panel: it is the panel's job, and a
 * second writer would be a second thing free to disagree with it.
 */
export function useQuickTasksFeed(settings: Settings | null) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [pinnedIds, setPinnedIds] = useState<number[]>([]);
  const [title, setTitle] = useState('');
  // The link a drafted follow-up carries into the new task's description.
  const [noteUrl, setNoteUrl] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentId = settings ? positiveId(settings.quickTaskParentId) : null;
  const archiveId = settings ? positiveId(settings.quickTaskArchiveId) : null;

  const reload = useCallback(async () => {
    if (!settings || parentId === null) {
      return;
    }
    const response = await fetchQuickTasks({
      settings,
      closedDateRange: await loadWorkItemsClosedDateRange(),
      scope: 'all'
    });
    if (response.ok) {
      setItems(response.result);
      setError(null);
    } else {
      setError(response.error);
    }
  }, [settings, parentId]);

  useEffect(() => {
    void loadPinnedQuickTaskIds().then(setPinnedIds);
    void reload();
  }, [reload]);

  async function run(action: () => Promise<void>) {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  }

  return {
    items: sortQuickTasks(items, pinnedIds),
    pinnedIds,
    parentId,
    archiveId,
    title,
    error,
    isBusy,
    noteUrl,
    setTitle: (value: string) => {
      setTitle(value);
      // An emptied box is an abandoned draft, link and all.
      if (value.trim() === '') {
        setNoteUrl(null);
      }
    },
    /** Fills the box with a follow-up to an item; nothing is created yet. */
    draftFollowUp: (itemTitle: string, url: string) => {
      setTitle(stripMentions(`Follow up: ${itemTitle}`));
      setNoteUrl(url);
    },
    dropNoteUrl: () => {
      setNoteUrl(null);
    },
    onCreate: () =>
      run(async () => {
        if (!settings || title.trim() === '') {
          return;
        }
        const response = await createQuickTask(
          settings,
          '',
          '',
          title.trim(),
          noteUrl ?? undefined
        );
        if (response.ok) {
          setTitle('');
          setNoteUrl(null);
          await reload();
        } else {
          setError(response.error);
        }
      }),
    onTogglePin: async (id: number) => {
      const next = togglePinnedId(pinnedIds, id);
      setPinnedIds(next);
      await savePinnedQuickTaskIds(next);
    },
    onArchive: (id: number) =>
      run(async () => {
        if (!settings) {
          return;
        }
        const response = await archiveQuickTask(settings, id);
        if (response.ok) {
          await reload();
        } else {
          setError(response.error);
        }
      })
  };
}
