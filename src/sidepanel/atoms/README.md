[root](../../../README.md) / [src](../../README.md) / [sidepanel](../README.md) / atoms

# `src/sidepanel/atoms/`

This directory contains shared side-panel shell atoms that are reused across top-level side-panel layout components.

## Files in this directory

- `ActiveWorkItemBanner.tsx` + `ActiveWorkItemBanner.module.css` — clickable active-work-item summary banner used by `App.tsx`.
- `ReconnectBanner.tsx` — shown when the connection status is **Reconnect needed**: offers the "Open Azure DevOps to reconnect" link and, after a failed automatic recovery, a manual **Retry** button.
- `SectionTabs.tsx` + `SectionTabs.module.css` — the one tab strip used by every tabbed region (work-item lists, settings sections), with optional per-tab counts and an `actions` slot for a control that belongs to the whole region rather than one tab. The strip scrolls horizontally rather than wrapping, with a trailing fade so a half-shown tab reads as scrollable; the actions slot sits outside the scroller so it stays reachable at 320px.
- `StarPageToggle.tsx` + `StarPageToggle.module.css` — the star button beside the favorites menu, highlighted while the current page is a favorite.
- `StarredPagesMenu.tsx` + `StarredPagesMenu.module.css` — searchable favorites menu with keyboard selection; never lists the page you are already on. Taking focus is retried until the search really holds it, because the panel window does not necessarily have focus when the browser opens it from a keyboard command, and focusing an element in an unfocused document does not route keystrokes to it. It also closes itself after five seconds untouched and carries its own dismiss button, because a side panel can lose focus with no event this document can see, leaving a full-height menu that no click of yours can reach. Losing window focus closes the menu — that is the only signal the panel gets when a click landed in the page — but only once focus has arrived, so the retries cannot close what they are opening. The popup is measured against the panel header rather than its trigger, so entries get the full panel width for their long URLs, and each row carries the page's icon from the browser's favicon cache (`favoriteIcon.ts`).
- `DeduplicateTabsButton.tsx` + `DeduplicateTabsButton.module.css` — closes duplicate Azure DevOps tabs.
