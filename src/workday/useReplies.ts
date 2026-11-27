import { useCallback, useEffect, useState } from 'react';
import type { Settings } from '@/types';
import { expectRuntimeResponse } from '@/sidepanel/tabMessaging/runtimeResponse';
import {
  pruneSeen,
  REPLIES_WINDOW_DAYS,
  unseen,
  type Reply,
  type SeenMarks
} from '@/devops/replies';

/** Browser-local: what was dismissed here is nobody else's business. */
const SEEN_KEY = 'workDayRepliesSeen';

async function loadSeen(): Promise<SeenMarks> {
  const stored = await chrome.storage.local.get(SEEN_KEY);
  const value = stored[SEEN_KEY] as SeenMarks | undefined;
  return value && typeof value === 'object' ? value : {};
}

/**
 * Threads waiting on the user over the last 14 days. Independent of the day
 * on screen: a reply is a loose end whichever day it is looked at from.
 */
export function useReplies(settings: Settings | null) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [seen, setSeen] = useState<SeenMarks>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSeen().then(setSeen);
  }, []);

  useEffect(() => {
    if (!settings) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = expectRuntimeResponse<Reply[]>(
          await chrome.runtime.sendMessage({
            type: 'FETCH_WORK_DAY_REPLIES',
            payload: { settings }
          }),
          'FETCH_WORK_DAY_REPLIES'
        );
        if (cancelled) {
          return;
        }
        if (response.ok) {
          setReplies(response.result);
          setError(null);
        } else {
          setError(response.error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settings]);

  const markSeen = useCallback(
    async (reply: Reply) => {
      const since = new Date(
        Date.now() - REPLIES_WINDOW_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      const next = pruneSeen({ ...seen, [reply.key]: reply.lastAt }, since);
      setSeen(next);
      await chrome.storage.local.set({ [SEEN_KEY]: next });
    },
    [seen]
  );

  const visible = unseen(replies, seen);
  return {
    mentions: visible.filter((r) => r.mention),
    replies: visible.filter((r) => !r.mention),
    isLoading,
    error,
    markSeen
  };
}
