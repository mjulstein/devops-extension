import { useEffect, useState } from 'react';
import { TAB_ICON_STORAGE_KEY } from '@/devops/sectionIcons';

/**
 * The Azure DevOps section icons the content script has scraped, kept current.
 *
 * It listens for changes rather than reading once, because the cache fills in
 * the background: the first visit to an Azure DevOps page scrapes the nav, and
 * a panel that had already read an empty cache would draw the built-in icons
 * until it was next opened.
 *
 * An empty record is a perfectly good answer — `sectionIconForUrl` falls back to
 * the icons compiled into the extension — so nothing waits on this.
 */
export function useSectionIcons(): Record<string, string> {
  const [icons, setIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    const read = (value: unknown) => {
      if (!cancelled && typeof value === 'object' && value !== null) {
        setIcons(value as Record<string, string>);
      }
    };

    void chrome.storage?.local
      ?.get(TAB_ICON_STORAGE_KEY)
      .then((stored) => read(stored[TAB_ICON_STORAGE_KEY]))
      .catch(() => undefined);

    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>
    ) => {
      if (TAB_ICON_STORAGE_KEY in changes) {
        read(changes[TAB_ICON_STORAGE_KEY].newValue);
      }
    };
    chrome.storage?.onChanged?.addListener(onChanged);

    return () => {
      cancelled = true;
      chrome.storage?.onChanged?.removeListener(onChanged);
    };
  }, []);

  return icons;
}
