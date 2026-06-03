[root](../../README.md) / [specs](../README.md) / [002-pat-auth-redesign](./spec.md) / plan.md

# Implementation Plan: PAT-Based Authentication Redesign

**Branch**: `[002-pat-auth-redesign]` | **Date**: 2026-05-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-pat-auth-redesign/spec.md`

## Summary

Make Azure DevOps data calls authenticate with a runtime-minted, auto-rotating PAT instead of the flaky browser session, and consolidate all of the auth machinery into a small, testable, replaceable adapter under `src/devops/auth/`. The service worker returns to being a generic message router; the page's main world is used only to hand back a fresh Bearer token. A derived connection status gates the side panel and drives a clean, user-controlled reconnect flow.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Vite, React, Chrome Extension APIs (`scripting`, `tabs`, `storage`)
**Storage**: `chrome.storage.local`
**Testing**: Vitest + ESLint + Vite build
**Target Platform**: Microsoft Edge / Chrome Manifest V3 extension
**Project Type**: browser extension
**Performance Goals**: ensure-valid PAT check must be cheap enough to run before every data op; no polling loops
**Constraints**: credential acquired at runtime, never committed; no backend/proxy (constitution I); auth lives inside the `src/devops/` adapter (VI); small single-responsibility units (VII); storage changes backwards-compatible (IV)
**Scale/Scope**: one auth module decomposed into ~6 units, an `authFetch` rewrite, a slimmed service worker, connection-status plumbing, and removal of the cookie features

## Constitution Check

- [x] I — Credential is runtime-minted, lives only in `chrome.storage.local`, no repo secrets, no backend
- [x] II — `content-script.ts` stays a generic bridge; Azure DevOps REST/auth logic under `src/devops/`
- [x] III — Last-visited org/project and work-item context flow preserved
- [x] IV — `PatRecord` shape unchanged; only additive storage key `lastRotateAttemptAt`
- [x] V — Spec, plan, and tasks captured before implementation
- [x] VI — All auth (PAT lifecycle, Bearer capture, status) inside the adapter; service worker generic
- [x] VII — Auth split into transport / policy / storage / freshness / orchestration / status units

## Project Structure

### Documentation (this feature)

```text
specs/002-pat-auth-redesign/
├── spec.md
├── plan.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── devops/
│   ├── auth/
│   │   ├── patApi.ts            # transport: create/revoke/list PATs via a Bearer token (no policy)
│   │   ├── rotationPolicy.ts    # pure: (record, now) -> 'use' | 'rotate' | 'reconnect'; no chrome/fetch
│   │   ├── patStore.ts          # storage + parse: PatRecord, deviceId, lastRotateAttemptAt
│   │   ├── bearerToken.ts       # freshness: decode JWT exp, isFresh(token)
│   │   ├── ensurePat.ts         # orchestrator (service worker): store -> policy -> patApi -> store
│   │   └── connectionStatus.ts  # derive Connected | ReconnectNeeded; broadcast to side panel
│   ├── authFetch.ts             # rewritten: PAT-only; 401 -> ensure/rotate once -> retry -> reconnect
│   └── (workItems.ts, childTasks.ts, parentAssignment.ts, taskCreation.ts, workItemDetails.ts unchanged)
├── token-interceptor.ts         # MAIN-world capture; posts a window message on a fresh capture
├── content-script.ts            # generic bridge; relays the capture signal to the service worker
└── service-worker.ts            # slimmed router; delegates auth to devops/auth, holds no PAT logic

types/
└── PatRecord.ts                 # unchanged
```

**Structure Decision**: `patLifecycle.ts` and the inline `mainWorldPatHandler` are both removed; their logic is split across the `devops/auth/` units so there is exactly one implementation. The only code that runs in the page's main world is a one-line Bearer read (for minting) plus the existing passive interceptor (for capture); everything else runs in the service worker where it is debuggable and unit-testable.

## Implementation Outline

### Phase 1 - Pure, testable core

- Add `rotationPolicy.ts` (the 24h / <12h decision) and `bearerToken.ts` (JWT `exp` freshness) as pure functions with full unit tests — no `chrome`, no `fetch`.
- Add `patStore.ts` with `PatRecord`/`deviceId`/`lastRotateAttemptAt` read-write-parse (absorbing today's `parsePatRecord` and storage-key constants).

### Phase 2 - Transport and orchestration

- Add `patApi.ts`: `createPat` / `revokePat` / `listExtensionPats`, each taking an explicit Bearer token and org; rotation = create-new + revoke-old; no `PUT`/Extend.
- Add `ensurePat.ts`: read store → `rotationPolicy` → if rotation needed, read a **fresh** Bearer (one-line `executeScript` against an Azure DevOps tab, gated by `bearerToken.isFresh`) → `patApi` → persist → return status. Throttle via `lastRotateAttemptAt`.
- Delete `mainWorldPatHandler` and `patLifecycle.ts`; repoint importers to the new units.

### Phase 3 - authFetch rewrite

- `authFetch`: PAT only (`Basic`, `credentials: 'omit'`). On `401`, call `ensurePat` once and retry; on continued failure, raise a typed reconnect error. Remove the cookie fallback.

### Phase 4 - Connection status and reconnect flow

- `connectionStatus.ts`: derive status from PAT validity; broadcast changes (runtime message and/or `chrome.storage` change) to the side panel.
- Side panel: block all data actions while **Reconnect needed**; show the "Open Azure DevOps to reconnect" link (new tab → `dev.azure.com/{org}`).
- Recovery: `token-interceptor.ts` posts a window message on a fresh capture; `content-script.ts` relays it to the service worker, which attempts **exactly one** rotation; on failure, surface a manual **Retry**.

### Phase 5 - Removals and slim-down

- Remove `clearDevOpsCookies.ts`, its re-export, the `SettingsPane` cookie block, and the `cookies` manifest permission.
- Remove the `onStartup` rotation; rotation becomes lazy (sidepanel open / before data ops).
- Reduce `service-worker.ts` to message routing + delegation; move tab discovery / proxy concerns into the adapter.

### Phase 6 - Validation

- `npm run lint`, `npm test`, `npm run build`.
- Load unpacked; verify happy path across a simulated Bearer expiry, the reconnect flow (block → open tab → auto-recover → Retry), and a single active `…-devopsext` token.

### Phase 7 - Documentation

- Update `README.md`, `AGENTS.md`, and directory `README.md`s for the new `src/devops/auth/` module and removed cookie feature.
- Fold any still-useful operational notes from `HANDOFF.md` into this spec and retire the handoff.

## Operational notes

Folded in from the retired `HANDOFF.md` and updated with live-testing findings:

- **Module layout (as built):** `src/devops/auth/` holds `rotationPolicy`, `bearerToken`, `patStore`, `patApi`, `ensurePat`, `readBearerFromTab`, `revokeAllExtensionPats`, `connectionStatus`, and `connectionService`. `src/devops/authFetch.ts` is the PAT-only fetch wrapper exporting `ReconnectNeededError`.
- **Build / reload:** `npm run build` emits `dist/` (`service-worker.js` + `sidepanel.*` via Rollup; `content-script.js` + `token-interceptor.js` as esbuild IIFEs; `manifest.json` copied). After building, reload the extension in `edge://extensions` or `chrome://extensions`. **Existing DevOps tabs must be reloaded** so the latest `token-interceptor.js` re-injects; without this `window.__devopsExtCapturedAuth` is never set on those tabs.
- **Auto-recovery plumbing:** main-world code has no `chrome.runtime`, so the fresh-capture signal flows MAIN (`token-interceptor.ts` `window.postMessage`) → ISOLATED (`content-script.ts` relay) → service worker (`DEVOPS_BEARER_CAPTURED` → `connectionService.handleBearerCaptured`). The content script also checks `window.__devopsExtCapturedAuth` on its own load (`document_idle`) and sends the signal retroactively — necessary because `dev.azure.com` API calls can fire before the content script registers its listener.
- **Token interceptor capture scope:** the interceptor wraps calls to both `vssps.dev.azure.com` **and** `dev.azure.com`. `vssps` alone is insufficient because many DevOps pages (git, boards) never call it; `dev.azure.com` is called on every page load. Injection (re-attaching the captured auth to outgoing calls without one) remains `vssps`-only.
- **`readBearerFromTab` parallelism:** all open `dev.azure.com/*` tabs are queried in parallel with a 4 s per-tab timeout. Background tabs in Edge can have 20+ entries and many are frozen/suspended — querying only `tabs[0]` blocked indefinitely on these; parallel query with timeout reduces worst-case latency to 4 s regardless of tab count.
- **Connection status after `ROTATE_PAT`:** after the service worker successfully creates a PAT it calls `connectionService.ensure(org)` before returning. This broadcasts `CONNECTION_STATUS:connected` so the side panel banner dismisses without requiring a page reload.
- **`awaitingManualRetry` re-arming:** `handleBearerCaptured` resets `autoRecoveryAttempted` when `awaitingManualRetry` is true. This ensures that clicking "Open Azure DevOps" on the reconnect banner and completing sign-in triggers auto-recovery even if a previous silent attempt had already run.
- **Reconnect navigation:** the "Open Azure DevOps" button navigates to `https://dev.azure.com/{org}/{project}` (project included) rather than the org root, landing the user directly in their registered project.
- **`EnsurePatOutcome.mintError`:** set on any failure that reaches or attempts `createPat`, including the no-bearer and stale-bearer early exits. Surfaced in the ROTATE_PAT service worker handler and via the `connectionService` debug callback.
- **Service worker debug logging:** the service worker broadcasts `{ type: 'SW_DEBUG', payload: { message } }` at key points in the `ROTATE_PAT` handler and inside `connectionService` (via an optional `debug` callback injected at construction). The side panel renders these as `SW: …` entries in the debug console pane.
- **Settings pane — "Clear PAT data":** wipes `devopsExtPat`, `devopsExtDeviceId`, and `devopsExtLastRotateAttemptAt` from local storage. Use when rotation is stuck or after testing with revoked tokens. A fresh PAT is minted on the next bearer capture.
- **`chrome.runtime.sendMessage` timeout for `ROTATE_PAT`:** a 25 s `Promise.race` timeout guards the side panel's sendMessage call. On some Edge MV3 builds the service worker can terminate during an in-flight async operation without closing the message port, leaving the side panel's promise permanently pending and the "Rotate now" button stuck disabled.
- **PAT API facts (grounded in MS docs):** there is no in-place "regenerate" — `POST` always mints a new `authorizationId`; `PUT` returns `token: null` (Extend only). Revoked tokens linger visibly in the registry for months (cosmetic; accepted).
- **`PatRecord` shape** (`types/PatRecord.ts`) is unchanged and backwards-compatible; the only additive storage key is `lastRotateAttemptAt`.

## Complexity Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| Read the Bearer token from the page's main world | The MSAL access token exists only in the page's JS heap; the service worker cannot see it | There is no service-worker-side way to obtain the token; cookie auth is the unreliable path being removed |
| MAIN → ISOLATED → service-worker relay for auto-recovery | Main-world code has no `chrome.runtime` access, so it cannot message the service worker directly | Polling the tab for a fresh token was rejected — wasteful and explicitly out of the design |
| Rotation leaves revoked entries in the token registry | Azure DevOps has no hard-delete and no in-place value swap; revoked tokens linger for months | "Regenerate in place" does not exist in the API; accepting cosmetic, self-clearing clutter is the only option |
