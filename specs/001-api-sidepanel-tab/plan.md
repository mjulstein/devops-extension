[root](../../README.md) / [specs](../README.md) / [001-api-sidepanel-tab](./spec.md) / plan.md

# Implementation Plan: API Sidepanel Tab

**Branch**: `[001-api-sidepanel-tab]` | **Date**: 2026-04-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-api-sidepanel-tab/spec.md`

## Summary

Add an `API` tab to the side panel so users can compose authenticated Azure DevOps REST requests, inspect the latest response in-panel, copy the latest request/result, and save reusable request macros in browser-local storage. Keep `src/content-script.ts` generic by routing new request execution through the service worker and concentrating Azure DevOps request validation, normalization, and execution logic under `src/devops/` plus a dedicated side-panel UI section.

## Technical Context

**Language/Version**: TypeScript 5.x  
**Primary Dependencies**: Vite, React, Chrome Extension APIs, clsx  
**Storage**: `chrome.storage.local`  
**Testing**: Vitest + ESLint + Vite build  
**Target Platform**: Microsoft Edge Manifest V3 extension  
**Project Type**: browser extension  
**Performance Goals**: keep side panel interactions responsive, prevent duplicate in-flight submissions, and avoid making large response logging block normal side-panel usage  
**Constraints**: authenticated browser-session access only; no PATs or backend proxy; preserve current service-worker/content-script/side-panel boundaries; keep storage changes backwards-compatible  
**Scale/Scope**: one new side-panel tab, supporting storage/types, service-worker messaging, and Azure DevOps request helpers

## Constitution Check

- [x] Uses the active authenticated browser session
- [x] Keeps `src/content-script.ts` generic and Azure DevOps-specific logic under `src/devops/`
- [x] Preserves the current service-worker and side-panel context flow unless the spec explicitly changes it
- [x] Updates docs and spec artifacts affected by the change

## Project Structure

### Documentation (this feature)

```text
specs/001-api-sidepanel-tab/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── devops/
│   ├── apiRequestExecution.ts          # new Azure DevOps request validation/execution helpers
│   └── typeGuards.ts                   # extend only if shared response guards are useful
├── sidepanel/
│   ├── App.tsx
│   ├── Tabs.tsx
│   ├── chromeStorage.ts
│   ├── useSidepanelController.ts
│   ├── DebugConsolePane.tsx
│   ├── api/                           # new API tab UI/components + local README.md
│   └── tabMessaging/
│       ├── index.ts
│       └── sendApiRequest.ts          # new side-panel → service-worker helper
├── content-script.ts
└── service-worker.ts

types/
├── ApiMacro.ts                        # new
├── ApiRequestDraft.ts                 # new
├── ApiRequestExecution.ts             # new
└── ApiResponseRecord.ts               # new
```

**Structure Decision**: Implement the feature as an additive side-panel section under `src/sidepanel/api/`, keep request execution reachable from the service worker so the tab still works when the active tab is not Azure DevOps, and use shared `types/` plus `chrome.storage.local` helpers for macro persistence and latest execution state.

## Implementation Outline

### Phase 1 - Contracts and storage shape

- Introduce shared request, execution, response, and macro types in `types/`.
- Extend side-panel storage helpers with migration-friendly load/save functions for API macros and any persisted latest-execution state that should survive panel reloads.
- Define a small, explicit runtime message contract for API request execution.

### Phase 2 - Authenticated request execution

- Add a service-worker runtime message that accepts a validated request payload and performs the fetch with the current authenticated browser session.
- Implement Azure DevOps-specific URL validation, method/body capability checks, body parsing/serialization, and JavaScript snippet generation under `src/devops/`.
- Surface structured success/error results so the side panel can distinguish validation issues, authentication failures, and response parsing problems.

### Phase 3 - API tab UI and controller wiring

- Extend `SidepanelTabId`, `Tabs.tsx`, `App.tsx`, and `useSidepanelController.ts` to mount the new `API` tab.
- Add the `API` tab UI under `src/sidepanel/api/` with the docs link, URL input, method selector, conditional body input, submit button, latest response view, and copy helpers.
- Reuse the existing debug-console pattern by logging request/response lifecycle updates from the controller.

### Phase 4 - Macro workflow

- Add save/use/edit/delete macro flows backed by browser-local storage.
- Keep newest macros first and support review/edit/delete in a modal, with an accessible fallback if right-click alone is insufficient.
- Ensure macro persistence is backwards-compatible and easy to normalize if the stored shape evolves.

### Phase 5 - Validation and documentation

- Add focused unit coverage for new validation helpers, storage normalization, tab messaging, and macro ordering/edit behavior.
- Update `README.md`, `AGENTS.md`, and directory docs if the implementation changes visible tabs, storage shape, or file structure.
- Validate with `npm run lint`, `npm test`, and `npm run build` once implementation begins.

## Complexity Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| Route API requests through the service worker | The tab must work with the authenticated browser session even when the active tab is not an Azure DevOps page | A content-script-only implementation would depend on the current tab context and would weaken the existing generic content-script boundary |
| Add a dedicated `src/sidepanel/api/` section | The feature introduces a full new tab with its own controls, result view, and macro management workflow | Folding the UI into `App.tsx` or `useSidepanelController.ts` would make existing shell files harder to maintain |
| Persist macros in browser-local storage with explicit normalization | Saved macros are a core P3 requirement and must survive side-panel reloads and future shape changes | Keeping macros only in React state would lose them between sessions and fail the reuse goal |

