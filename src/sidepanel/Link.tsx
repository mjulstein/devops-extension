import type { ComponentPropsWithoutRef, MouseEvent } from 'react';

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
  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    onClickProp?.(event);

    if (event.defaultPrevented || external || shouldLetBrowserHandle(event)) {
      return;
    }

    event.preventDefault();
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
