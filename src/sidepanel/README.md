[root](../../README.md) / [src](../README.md) / sidepanel

# `src/sidepanel/`

This directory contains the React side panel shell, browser storage helpers, navigation UI, and message helpers used to talk to the active tab or service worker.

Keep this document focused on files that live directly in `src/sidepanel/`. Use the child directory `README.md` files for the tab-specific component and messaging details.

## Files in this directory

- `App.tsx` + `App.module.css` — top-level side panel shell that composes the banner, tabs, and tab sections.
- `useSidepanelController.ts` — side-panel orchestration hook that hydrates storage, manages tab/work-item state, and exposes handlers to the shell components.
- `chromeStorage.ts` — browser-local storage helpers for settings-adjacent side-panel state such as cached results, closed-date range and parent-detail work-item preferences, active tab, hidden task states, parent suggestions, and pinned active context.
- `DebugConsolePane.tsx` + `DebugConsolePane.module.css` — in-panel developer log viewer used by `App.tsx`.
- `defaultSettings.ts` — default empty settings values used when storage has not been hydrated yet.
- `Link.tsx` — navigation helper that opens Azure DevOps links in the active tab when appropriate.
- `Tabs.tsx` + `Tabs.module.css` — tab chrome for the Work items, Active item, and Settings sections, including the pin toggle.
- `workItemsDateRange.ts` — default/validation helpers for the Work items tab closed-date range inputs.

The side panel uses colocated CSS modules for component styling. TypeScript support for `*.module.css` imports is declared in `src/css-modules.d.ts`, and shared Vite ambient types live in `src/vite-env.d.ts`.

## Subdirectories

- [`settings`](./settings/README.md) — Settings tab components.
- [`atoms`](./atoms/README.md) — shared shell atoms used by `App.tsx`.
- [`tabMessaging`](./tabMessaging/README.md) — helpers that wrap runtime and tab messaging.
- [`work-item`](./work-item/README.md) — Active item tab components.
- [`work-items`](./work-items/README.md) — Work items tab components.
