import { useEffect, useState } from 'react';
import { hostOf } from './appDns';
import { usageFromTabs } from './envSwitch';
import type { EnvContext } from '../favoritesListing';

const EMPTY: EnvContext = { usage: {}, currentHost: null };

/**
 * Which environment was last looked at, and which is on screen now.
 *
 * Read when the menu opens rather than kept live: it decides an ordering at the
 * moment you look at the list, and a list that reorders itself under the cursor
 * because a background tab woke up would be worse than one a few seconds stale.
 */
export function useEnvContext(isOpen: boolean): EnvContext {
  const [context, setContext] = useState<EnvContext>(EMPTY);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const tabs = await chrome.tabs.query({});
        const [active] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true
        });
        if (!cancelled) {
          setContext({
            usage: usageFromTabs(tabs),
            currentHost: active?.url ? hostOf(active.url) : null
          });
        }
      } catch {
        // No ordering is better than no list.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  return context;
}
