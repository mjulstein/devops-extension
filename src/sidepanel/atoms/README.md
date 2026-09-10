[root](../../../README.md) / [src](../../README.md) / [sidepanel](../README.md) / atoms

# `src/sidepanel/atoms/`

This directory contains shared side-panel shell atoms that are reused across top-level side-panel layout components.

## Files in this directory

- `ActiveWorkItemBanner.tsx` + `ActiveWorkItemBanner.module.css` — clickable active-work-item summary banner used by `App.tsx`.
- `ReconnectBanner.tsx` — shown when the connection status is **Reconnect needed**: offers the "Open Azure DevOps to reconnect" link and, after a failed automatic recovery, a manual **Retry** button.
- `SectionTabs.tsx` + `SectionTabs.module.css` — the one tab strip used by every tabbed region (work-item lists, settings sections), with optional per-tab counts. It scrolls horizontally rather than wrapping, so a narrow panel never clips the last tab.
- `StarPageToggle.tsx` + `StarPageToggle.module.css` — the star button beside the favorites menu, highlighted while the current page is a favorite.
- `StarredPagesMenu.tsx` + `StarredPagesMenu.module.css` — searchable favorites menu with keyboard selection; never lists the page you are already on.
- `DeduplicateTabsButton.tsx` + `DeduplicateTabsButton.module.css` — closes duplicate Azure DevOps tabs.
