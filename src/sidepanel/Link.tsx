import type { ComponentPropsWithoutRef, MouseEvent } from 'react';
import { getWorkItemIdFromUrl } from '@/devops/urlContext';

interface LinkProps extends Omit<
  ComponentPropsWithoutRef<'a'>,
  'href' | 'target' | 'rel'
> {
  href: string;
  external?: boolean;
}

export function Link({
  href,
  external = false,
  onClick: onClickProp,
  ...props
}: LinkProps) {
  async function onClick(event: MouseEvent<HTMLAnchorElement>) {
    onClickProp?.(event);

    if (event.defaultPrevented || shouldLetBrowserHandle(event)) {
      return;
    }

    event.preventDefault();

    // If the link is marked external we normally open a new tab. Instead,
    // try to find an existing DevOps tab that already shows the same work item
    // (by id) and switch to that tab. If none is found, open a new tab.
    if (external) {
      try {
        const workItemId = getWorkItemIdFromUrl(href);

        if (workItemId) {
          const tabs = await chrome.tabs.query({});
          const match = tabs.find((t) => {
            if (!t.url) return false;
            const id = getWorkItemIdFromUrl(t.url);
            return id === workItemId;
          });

          if (match && typeof match.id === 'number') {
            // Focus the window containing the tab (best-effort) then activate the tab.
            try {
              if (typeof match.windowId === 'number') {
                await chrome.windows.update(match.windowId, { focused: true });
              }
            } catch {
              // ignore window focus errors
            }

            await chrome.tabs.update(match.id, { active: true });
            return;
          }
        }

        // No existing tab for the target work item, open a new tab.
        await chrome.tabs.create({ url: href });
        return;
      } catch {
        // Fall back to opening a new tab on error.
        try {
          await chrome.tabs.create({ url: href });
        } catch {
          // swallow
        }
        return;
      }
    }

    // Non-external links navigate the active tab as before.
    void navigateActiveTab(href);
  }

  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      onClick={onClick}
      {...props}
    />
  );
}

async function navigateActiveTab(url: string): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    return;
  }

  await chrome.tabs.update(tab.id, { url });
}

function shouldLetBrowserHandle(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
