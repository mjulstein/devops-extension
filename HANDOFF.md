# DevOps Extension — Auth Handoff

## TL;DR

The PAT authentication flow has been **redesigned**. The design is now fully specified and documented — this handoff is just the operational entry point. Read these first, in order:

1. [`CONTEXT.md`](./CONTEXT.md) — the vocabulary (PAT, Bearer token, Rotate vs Extend, Connection state).
2. [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) **v2.1.0** — Principles I (runtime credentials), VI (replaceable providers), VII (small units).
3. [`docs/adr/0001-replaceable-provider-adapters.md`](./docs/adr/0001-replaceable-provider-adapters.md) — why auth lives inside the `src/devops/` adapter.
4. [`specs/002-pat-auth-redesign/`](./specs/002-pat-auth-redesign/spec.md) — spec, plan, and tasks. **This is the implementation source of truth.**

## What this extension does

Chrome/Edge MV3 extension for Azure DevOps. It surfaces work items in a side panel and acts on them via the Azure DevOps REST API. The relevant problem: the office ENTRA SSO session drops its short-lived Bearer token several times a day and can't silently renew it, which used to break every API call and strand the user on a "sign out" error page.

## The chosen solution (target design)

Authenticate **data calls** with a runtime-minted **PAT** (HTTP Basic), so they no longer depend on the flaky browser session. The browser session is used **only** to obtain a fresh **Bearer token** with which to mint/rotate the PAT.

- **Lifecycle:** ~24h validity; **rotate** (new secret value + revoke old, stable `{deviceId}-devopsext` name) when <12h remains — effectively once each working morning. Never **Extend**. Triggered **lazily** (sidepanel open / before data ops), never `onStartup`. Throttled by `lastRotateAttemptAt`.
- **Freshness:** a Bearer token is fired only if its JWT `exp` shows headroom; a stale token is never sent (sending one can break the session).
- **Reconnect:** no valid PAT + no fresh Bearer ⇒ **Reconnect needed** — all side-panel data actions are blocked and a link opens a *new* `dev.azure.com/{org}` tab so any SSO/ENTRA prompt lands on a tab the user controls. One automatic rotation is attempted when a fresh Bearer is captured; if it fails, a manual **Retry** is shown (no further auto-retries).
- **Architecture:** all auth (PAT lifecycle, Bearer capture, connection status) lives in `src/devops/auth/` as small single-responsibility units. `service-worker.ts` is a generic router. The page's main world is used only to return the captured Bearer token.

## Current code vs. target

The repo currently contains an earlier **prototype** of the PAT flow that this redesign replaces:

| Area | Current (prototype) | Target (spec 002) |
|---|---|---|
| Lifecycle logic | Duplicated: dead `src/devops/patLifecycle.ts` **and** inline `mainWorldPatHandler` in `service-worker.ts` | One implementation in `src/devops/auth/*`; main world reduced to a one-line Bearer read |
| Rotation | `PUT`/renew path + 14d/7d thresholds; `onStartup` trigger | Create-new + revoke-old only; 24h/12h; lazy trigger; `lastRotateAttemptAt` throttle |
| Bearer freshness | Uses last passively-captured token (may be stale) | Gated on JWT `exp`; stale never fired |
| Failure UX | "Rotate now" could silently no-op | Derived connection status blocks the panel + reconnect link + auto-once-then-Retry |
| Cookies | Manual "Clear DevOps Cookies" button + `authFetch` cookie fallback + `cookies` permission | All removed; PAT-only data path |

### Verified working in the prototype (still useful signal)

- The token interceptor wraps `window.fetch` at `document_start` and captures Bearer tokens from the page's own `vssps.dev.azure.com` calls.
- A plain `fetch` to the PAT Lifecycle API from the ADO tab succeeds (HTTP 200 + JSON) with no explicit `Authorization` header — the interceptor injects it.
- PAT creation works end-to-end when run inline in the ADO tab's main world.

These confirm the Bearer-capture mechanism; the redesign keeps it (capture) and moves everything else into the testable adapter.

## Build

```
npm run build
```

Output goes to `dist/`:
- `dist/service-worker.js` (Rollup bundle)
- `dist/sidepanel.js` + `dist/sidepanel.html`
- `dist/content-script.js` (esbuild IIFE)
- `dist/token-interceptor.js` (esbuild IIFE) ← injected at `document_start`, critical for Bearer capture

After building: reload the extension in `chrome://extensions`, then **refresh the Azure DevOps tab** so the latest `token-interceptor.js` is injected.

## Key types

```typescript
// types/PatRecord.ts
interface PatRecord {
  token: string;          // the secret value
  authorizationId: string;
  expiresAt: number;      // ms since epoch
  displayName: string;    // `{deviceId}-devopsext`
}
```

Stored in `chrome.storage.local` under `devopsExtPat`; the device id under `devopsExtDeviceId`. The redesign adds an additive `lastRotateAttemptAt` key for rotation throttling. `PatRecord` itself is unchanged (backwards-compatible per constitution IV).
