import { getWorkItemIdFromUrl } from './urlContext';

export function detectActiveWorkItemId(
  forceResync: boolean
): number | undefined {
  const visuallyActiveWorkItemId = detectVisuallyActiveWorkItemId();
  if (visuallyActiveWorkItemId) {
    return visuallyActiveWorkItemId;
  }

  if (!forceResync) {
    return undefined;
  }

  return detectActiveWorkItemIdFromDom() ?? undefined;
}

function detectActiveWorkItemIdFromDom(): number | null {
  // Prefer explicit id text from the work item header/form.
  const strictIdSelectors = [
    '[data-testid="work-item-id"]',
    '.work-item-form-id',
    '.work-item-titlebar-id',
    '[aria-label="Work item ID"]'
  ];

  for (const selector of strictIdSelectors) {
    const element = document.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const strict = parseStrictWorkItemId(element.innerText);
    if (strict) {
      return strict;
    }
  }

  // Next best: links to edit pages inside the main content area.
  const mainRoot =
    document.querySelector('[role="main"]') ??
    document.querySelector('.work-item-form') ??
    document.body;

  const linkCandidates = Array.from(
    mainRoot.querySelectorAll('a[href*="/_workitems/edit/"]')
  ).filter(
    (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement
  );

  const ranked = linkCandidates
    .map((link) => ({ link, score: scoreWorkItemLinkCandidate(link) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  for (const entry of ranked) {
    const detected = getWorkItemIdFromUrl(entry.link.href);
    if (!detected || !isLikelyWorkItemId(detected)) {
      continue;
    }

    return detected;
  }

  return null;
}

function detectVisuallyActiveWorkItemId(): number | null {
  const topmostSurface = detectTopmostSurfaceFromViewport();
  if (topmostSurface) {
    const id = detectWorkItemIdInSurface(topmostSurface);
    if (id) {
      return id;
    }
  }

  const surfaceSelectors = [
    '[role="dialog"]',
    '.bolt-panel',
    '.work-item-view',
    '.work-item-form',
    '[data-testid*="work-item"]'
  ];

  const surfaces = Array.from(
    new Set(
      surfaceSelectors.flatMap((selector) =>
        Array.from(document.querySelectorAll(selector))
      )
    )
  ).filter((node): node is HTMLElement => node instanceof HTMLElement);

  const ranked = surfaces
    .filter((surface) => isElementVisible(surface))
    .map((surface) => ({
      surface,
      score: scoreWorkItemSurface(surface)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  for (const entry of ranked) {
    const id = detectWorkItemIdInSurface(entry.surface);
    if (id) {
      return id;
    }
  }

  return null;
}

function detectTopmostSurfaceFromViewport(): HTMLElement | null {
  const samplePoints: Array<{ x: number; y: number }> = [
    { x: 60, y: 60 },
    { x: 120, y: 90 },
    { x: 220, y: 90 }
  ];

  const surfaceSelectors =
    '[role="dialog"], .bolt-panel, .work-item-view, .work-item-form, [data-testid*="work-item"]';

  for (const point of samplePoints) {
    const stack = document.elementsFromPoint(point.x, point.y);

    for (const element of stack) {
      if (!(element instanceof HTMLElement)) {
        continue;
      }

      const surface = element.closest(surfaceSelectors);
      if (!(surface instanceof HTMLElement)) {
        continue;
      }

      if (!isElementVisible(surface)) {
        continue;
      }

      return surface;
    }
  }

  return null;
}

function detectWorkItemIdInSurface(surface: HTMLElement): number | null {
  const surfaceRect = surface.getBoundingClientRect();

  const headerLinkCandidates = Array.from(
    surface.querySelectorAll('a[href*="/_workitems/edit/"]')
  )
    .filter(
      (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement
    )
    .filter((link) => isElementVisible(link))
    .map((link) => ({
      link,
      rect: link.getBoundingClientRect()
    }))
    .filter(
      ({ rect }) =>
        rect.top >= surfaceRect.top && rect.top <= surfaceRect.top + 180
    )
    .map((entry) => ({
      ...entry,
      score: scoreHeaderLinkCandidate(entry.link, entry.rect)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      return (
        right.score - left.score ||
        left.rect.top - right.rect.top ||
        right.rect.left - left.rect.left
      );
    });

  for (const entry of headerLinkCandidates) {
    const id = getWorkItemIdFromUrl(entry.link.href);
    if (id && isLikelyWorkItemId(id)) {
      return id;
    }
  }

  const strictIdSelectors = [
    '[data-testid="work-item-id"]',
    '.work-item-form-id',
    '.work-item-titlebar-id',
    '[aria-label="Work item ID"]'
  ];

  for (const selector of strictIdSelectors) {
    const element = surface.querySelector(selector);
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const strict = parseStrictWorkItemId(element.innerText);
    if (strict) {
      return strict;
    }
  }

  return null;
}

function scoreHeaderLinkCandidate(
  link: HTMLAnchorElement,
  rect: DOMRect
): number {
  const text = normalizeText(link.innerText);
  if (!text || !hasWorkItemTypeAndNumber(text)) {
    return 0;
  }

  let score = 10;

  // Current breadcrumb/page marker should always win when available.
  if (link.matches('[aria-current="page"]')) {
    score += 100;
  }

  if (link.closest('[aria-selected="true"], .selected, .is-selected')) {
    score += 40;
  }

  // In breadcrumb chains, the active item is typically the last/right-most one.
  if (link.parentElement?.matches(':last-child')) {
    score += 20;
  }

  // Prefer links rendered in the top-left title row.
  if (rect.top <= 90) {
    score += 15;
  }

  // Prefer right-most header link when there are multiple parent layers.
  score += Math.min(30, Math.floor(rect.left / 40));

  return score;
}

function scoreWorkItemSurface(surface: HTMLElement): number {
  const rect = surface.getBoundingClientRect();

  if (rect.width < 120 || rect.height < 80) {
    return 0;
  }

  let score = 0;

  // Surfaces with a close/X control are usually the visually opened item.
  if (
    surface.querySelector(
      '[aria-label*="Close" i], [title*="Close" i], .bowtie-icon-close'
    )
  ) {
    score += 200;
  }

  // Prefer surfaces near the top-left viewing area.
  if (rect.top >= 0 && rect.top < 220) {
    score += 40;
  }

  if (rect.left >= 0 && rect.left < 700) {
    score += 25;
  }

  // Prefer bigger visible forms over tiny widgets.
  score += Math.min(120, Math.floor((rect.width * rect.height) / 12000));

  // If z-index is present, use it as additional signal.
  const zIndexRaw = window.getComputedStyle(surface).zIndex;
  const zIndex = Number.parseInt(zIndexRaw, 10);
  if (Number.isFinite(zIndex)) {
    score += Math.max(0, Math.min(120, zIndex));
  }

  return score;
}

function parseStrictWorkItemId(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  const exactMatch = /^#?(\d{2,8})$/.exec(trimmed);

  if (!exactMatch) {
    return null;
  }

  const parsed = Number(exactMatch[1]);
  return isLikelyWorkItemId(parsed) ? parsed : null;
}

function scoreWorkItemLinkCandidate(link: HTMLAnchorElement): number {
  if (!isElementVisible(link)) {
    return 0;
  }

  let score = 1;

  if (link.matches('[aria-current="page"]')) {
    score += 8;
  }

  if (link.closest('[aria-selected="true"], .selected, .is-selected')) {
    score += 5;
  }

  if (link.closest('[role="main"], .work-item-form, .work-item-view')) {
    score += 3;
  }

  return score;
}

function isElementVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isLikelyWorkItemId(id: number): boolean {
  // Avoid false positives from sprint numbers or tiny identifiers during manual resync.
  return Number.isFinite(id) && id >= 1000;
}

function hasWorkItemTypeAndNumber(value: string): boolean {
  return (
    /\b(feature|epic|bug|task|pbi|product backlog item|improvement)\b/i.test(
      value
    ) && /\d{2,8}/.test(value)
  );
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
