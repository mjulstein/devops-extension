[root](../../README.md) / [specs](../README.md) / [002-pat-auth-redesign](./spec.md) / tasks.md

# Task Breakdown: PAT-Based Authentication Redesign

**Branch**: `[002-pat-auth-redesign]` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Phase 1: Pure, testable core

- [x] Add `src/devops/auth/rotationPolicy.ts` — pure `(record, now) => 'use' | 'rotate' | 'reconnect'` using 24h validity / <12h rotation threshold; no `chrome`, no `fetch`.
- [x] Add `src/devops/auth/bearerToken.ts` — decode a JWT's `exp` claim and expose `isFresh(token, marginMs)`; no network, no verification.
- [x] Add `src/devops/auth/patStore.ts` — read/write/parse `PatRecord`, `deviceId`, and the new `lastRotateAttemptAt`; absorb today's `parsePatRecord` and storage-key constants.
- [x] Add unit tests for `rotationPolicy` (use/rotate/reconnect boundaries) and `bearerToken` (fresh/stale/malformed), with no `chrome`/`fetch` dependencies.

## Phase 2: Transport and orchestration

- [x] Add `src/devops/auth/patApi.ts` — `createPat`, `revokePat`, `listExtensionPats`, each taking an explicit Bearer token + org; rotation = create-new then revoke-old; no `PUT`/Extend.
- [x] Add `src/devops/auth/ensurePat.ts` — orchestrate store → `rotationPolicy` → (if rotating) read a fresh Bearer via a one-line main-world `executeScript`, gated by `bearerToken.isFresh` → `patApi` → persist; throttle with `lastRotateAttemptAt`.
- [x] Delete `mainWorldPatHandler` from `service-worker.ts` and delete `src/devops/patLifecycle.ts`; repoint all importers to the new units.
- [x] Add unit tests for `ensurePat` decision flow with `patApi`/store/bearer mocked.

## Phase 3: authFetch rewrite

- [x] Rewrite `src/devops/authFetch.ts` to use the PAT only (`Authorization: Basic`, `credentials: 'omit'`); on `401`, call `ensurePat` once and retry; on continued failure, throw a typed reconnect error. Remove the cookie fallback.
- [x] Add tests covering the PAT path, the single rotate-and-retry on `401`, and the reconnect-error case.

## Phase 4: Connection status and reconnect flow

- [x] Add `src/devops/auth/connectionStatus.ts` — derive `Connected | ReconnectNeeded` from PAT validity and broadcast changes to the side panel.
- [x] Side panel: gate all data actions on connection status; render the "Open Azure DevOps to reconnect" link (new tab → `dev.azure.com/{org}`) when reconnect is needed.
- [x] `token-interceptor.ts`: on capturing a fresh Bearer, `window.postMessage` a signal; add the relay in `content-script.ts` that forwards it to the service worker.
- [x] Service worker: on the relayed fresh-capture signal during reconnect, attempt exactly one rotation; on failure stop auto-retries and expose a manual **Retry** action in the side panel.
- [x] Tests for status derivation and the auto-once-then-manual recovery transition.

## Phase 5: Removals and slim-down

- [x] Delete `src/sidepanel/tabMessaging/clearDevOpsCookies.ts` and its re-export in `tabMessaging/index.ts`.
- [x] Remove the cookie description, button, state, and handler from `SettingsPane.tsx`.
- [x] Remove the `"cookies"` permission from `src/manifest.json`.
- [x] Remove the `onStartup` rotation; confirm rotation is only triggered lazily (sidepanel open / before data ops).
- [x] Reduce `service-worker.ts` to message routing + delegation; move tab discovery / `executeScript` proxy into the adapter.

## Phase 6: Validation

- [x] Run `npm run lint`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Load the unpacked extension from `dist/` and verify: data calls work across a simulated Bearer expiry; the reconnect flow (block → open tab → auto-recover → manual Retry on failure) behaves per spec; the Azure DevOps tokens page shows one active `…-devopsext` entry. **(Validated in Edge and Chrome — see operational notes in `plan.md` for live-testing findings.)**

## Phase 7: Documentation

- [x] Update `README.md`, `AGENTS.md`, and affected directory `README.md`s for the new `src/devops/auth/` module and the removed cookie feature.
- [x] Fold any still-useful operational notes from `HANDOFF.md` into this spec set and retire `HANDOFF.md`.
- [x] Record any intentionally deferred scope (e.g. provider-contributed settings UI, generic `RECONNECT` message) back into `specs/ideas/`.
