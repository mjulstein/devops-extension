import type { ComponentPropsWithoutRef, MouseEvent } from 'react';
import { navigateToWorkItem } from './navigateToWorkItem';

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

    if (event.defaultPrevented || shouldLetBrowserHandle(event)) {
      return;
    }

    event.preventDefault();

    void navigateToWorkItem(href, external);
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

function shouldLetBrowserHandle(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}
