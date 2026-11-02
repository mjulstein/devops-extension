import { useCallback, useEffect, useState } from 'react';
import { readWindows, type DeckWindow } from './windowDeck';

/**
 * The open windows, kept current.
 *
 * Re-read on every window and tab event rather than patched. The list is
 * short, and a second model of the browser's windows — kept correct through
 * opens, closes, tab moves between windows and the title changing because
 * somebody navigated — is more to go wrong than asking again.
 *
 * The deck's own window is left out: it is a popup, and `readWindows` drops
 * those, so switching to the thing you are already looking at is never offered.
 */
export function useWindowDeck(): {
  windows: DeckWindow[];
  refresh: () => void;
} {
  const [windows, setWindows] = useState<DeckWindow[]>([]);

  const refresh = useCallback(() => {
    void chrome.windows
      ?.getAll({ populate: true })
      .then((all) => {
        setWindows(readWindows(all));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();

    const events = [
      chrome.windows?.onCreated,
      chrome.windows?.onRemoved,
      chrome.windows?.onFocusChanged,
      chrome.tabs?.onCreated,
      chrome.tabs?.onRemoved,
      chrome.tabs?.onUpdated,
      chrome.tabs?.onActivated,
      chrome.tabs?.onAttached,
      chrome.tabs?.onDetached
    ];
    for (const event of events) {
      event?.addListener(refresh);
    }
    return () => {
      for (const event of events) {
        event?.removeListener(refresh);
      }
    };
  }, [refresh]);

  return { windows, refresh };
}
