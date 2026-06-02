[root](../../../README.md) / [src](../../README.md) / [devops](../README.md) / auth

# `src/devops/auth/`

The Azure DevOps authentication adapter. All credential logic — PAT lifecycle, Bearer-token freshness, and connection status — lives here as small single-responsibility units, so `src/service-worker.ts` stays a generic message router. Data calls authenticate with a runtime-minted, auto-rotating Personal Access Token; the browser session is used only to mint it. See [`CONTEXT.md`](../../../CONTEXT.md) for the vocabulary and [`specs/002-pat-auth-redesign`](../../../specs/002-pat-auth-redesign/spec.md) for the design.

## Files in this directory

- `rotationPolicy.ts` — pure `decideRotation(record, now) → 'use' | 'rotate' | 'reconnect'` using ~24h validity / <12h rotation threshold; no `chrome`, no `fetch`.
- `rotationPolicy.test.ts` — boundary coverage for the rotation decision.
- `bearerToken.ts` — decodes a JWT's `exp` claim and exposes `isFresh(token, marginMs, now)`; the extension only fires a PAT-API request with a Bearer it has confirmed is fresh. No network, no signature verification.
- `bearerToken.test.ts` — fresh/stale/malformed token coverage.
- `patStore.ts` — read/write/parse of the `PatRecord`, `deviceId`, and the additive `lastRotateAttemptAt` throttle key; owns the `chrome.storage.local` key names.
- `patApi.ts` — transport for the PAT Lifecycle API (`createPat`, `revokePat`, `listExtensionPats`), each taking an explicit Bearer token and org. Rotation is create-new + revoke-old; the `PUT`/Extend operation is never used.
- `ensurePat.ts` — orchestrates store → `rotationPolicy` → fresh Bearer (via `readBearerFromTab`) → `patApi` → persist. Throttles repeated attempts via `lastRotateAttemptAt`; `force` re-mints a rejected-but-unexpired PAT.
- `ensurePat.test.ts` — decision-flow coverage with store/api/bearer mocked.
- `readBearerFromTab.ts` — queries **all** open `dev.azure.com/*` tabs in parallel with a 4 s per-tab timeout and returns the first captured Bearer found. Parallel query is necessary because background tabs (common with 20+ tabs in Edge) can freeze `executeScript` indefinitely; a single `tabs[0]` query would block on these.
- `revokeAllExtensionPats.ts` — manual maintenance action that revokes every `…-devopsext` token-registry entry and clears the stored PAT.
- `connectionStatus.ts` — derives `Connected | ReconnectNeeded` from PAT validity (`deriveConnectionStatus`) and decides whether the single auto-recovery should fire (`shouldAttemptAutoRecovery`).
- `connectionStatus.test.ts` — derivation and auto-recovery-gate coverage.
- `connectionService.ts` — stateful reconnect controller: lazy `ensure`, manual `retry`, and one automatic rotation on a captured Bearer, then manual Retry. Re-arms auto-recovery when `awaitingManualRetry` is true and a new distinct bearer arrives. Broadcasts status changes to the side panel via an optional `debug` callback for service-worker logging.
- `connectionService.test.ts` — auto-once-then-manual recovery transition coverage, including the re-arm-on-new-bearer case.
