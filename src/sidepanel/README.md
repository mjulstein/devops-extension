[root](../../README.md) / [src](../README.md) / sidepanel

# `src/sidepanel/`

This directory contains the React side panel shell, browser storage helpers, navigation UI, and message helpers used to talk to the active tab or service worker.

Keep this document focused on files that live directly in `src/sidepanel/`. Use the child directory `README.md` files for the tab-specific component and messaging details.

## Files in this directory

- `App.tsx` — top-level side panel state container that hydrates settings/storage, manages tabs, drives work-item actions, and renders the panel sections, including closed-date range refreshes for the Work items tab.
- `chromeStorage.ts` — browser-local storage helpers for settings-adjacent side-panel state such as cached results, closed-date range and parent-detail work-item preferences, active tab, hidden task states, parent suggestions, and pinned active context.
- `DebugConsolePane.tsx` — in-panel developer log viewer used by `App.tsx`.
- `defaultSettings.ts` — default empty settings values used when storage has not been hydrated yet.
- `Link.tsx` — navigation helper that opens Azure DevOps links in the active tab when appropriate.
- `Tabs.tsx` — tab chrome for the Work items, Active item, and Settings sections, including the pin toggle.
- `workItemsDateRange.ts` — default/validation helpers for the Work items tab closed-date range inputs.

## Subdirectories

- [`settings`](./settings/README.md) — Settings tab components.
- [`tabMessaging`](./tabMessaging/README.md) — helpers that wrap runtime and tab messaging.
- [`work-item`](./work-item/README.md) — Active item tab components.
- [`work-items`](./work-items/README.md) — Work items tab components.


