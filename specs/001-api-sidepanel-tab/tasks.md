[root](../../README.md) / [specs](../README.md) / [001-api-sidepanel-tab](./spec.md) / tasks.md

# Task Breakdown: API Sidepanel Tab

**Branch**: `[001-api-sidepanel-tab]` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Foundation

- [ ] Confirm unresolved UX details from `spec.md` edge cases, especially malformed URLs, invalid JSON bodies, large response rendering, and the exact behavior of invoking a saved macro.
- [ ] Add shared API request/response/macro types under `types/` and export them from `types/index.ts`.
- [ ] Define a backwards-compatible storage shape for API macros and any persisted latest execution state in `src/sidepanel/chromeStorage.ts`.
- [ ] Add or update directory docs if implementation introduces a new `src/sidepanel/api/` source directory.

## Phase 2: Authenticated Request Plumbing

- [ ] Add a new side-panel messaging helper under `src/sidepanel/tabMessaging/` for sending API requests through the runtime.
- [ ] Extend `src/service-worker.ts` with an API-request message handler that performs authenticated Azure DevOps fetches.
- [ ] Implement Azure DevOps-specific request normalization, URL validation, method/body rules, response capture, and JavaScript snippet generation under `src/devops/`.
- [ ] Add unit tests for request validation/normalization and the new messaging helper behavior.

## Phase 3: API Tab UI

- [ ] Extend `SidepanelTabId`, `Tabs.tsx`, `App.tsx`, and `useSidepanelController.ts` to support the new `API` tab.
- [ ] Create `src/sidepanel/api/` components and colocated CSS modules for the docs link, request form, conditional body editor, status area, latest response surface, and macro controls.
- [ ] Mirror request and response activity into `DebugConsolePane` through the controller's debug-log flow.
- [ ] Add empty-state and error-state messaging for copy actions when no request/result is available yet.

## Phase 4: Macro Persistence And Management

- [ ] Persist saved macros in `chrome.storage.local` with newest-first ordering and normalization for future storage migrations.
- [ ] Add the “save latest request as macro” action and render saved macros near the top of the `API` tab.
- [ ] Implement macro activation plus modal-based review/edit/delete behavior, with an accessible fallback interaction if right-click alone is insufficient.
- [ ] Add focused tests for macro ordering, persistence normalization, edit/delete flows, and any controller logic that restores macro drafts.

## Phase 5: Validation

- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Verify the unpacked extension still loads from `dist/` and the side panel can send authenticated requests, log results, copy artifacts, and reopen saved macros across sessions.

## Phase 6: Documentation

- [ ] Update `README.md` and `AGENTS.md` if the implemented feature changes visible tabs, setup notes, storage shape, or contributor workflow.
- [ ] Update `src/README.md`, `src/sidepanel/README.md`, and any new directory `README.md` files so the source map reflects the new tab.
- [ ] Link any deferred follow-up ideas back into `specs/ideas/` if scope is intentionally cut during implementation.

