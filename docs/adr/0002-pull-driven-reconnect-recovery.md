---
status: accepted
date: 2026-06-16
---

# Reconnect recovery is pull-driven (triggered by tab load), not push-driven (postMessage relay)

When the **PAT** expires, the extension recovers by minting a fresh one from a live Azure DevOps **Browser session**. That recovery is triggered when a `dev.azure.com` tab reaches `complete` while the connection is **Reconnect needed**: the service worker then *pulls* the **Bearer token** out of the tab's main world (`chrome.scripting.executeScript({ world: 'MAIN' })`, plus an MSAL-cache fallback) and attempts a **Rotate**. The older push relay — the main-world interceptor posting a `bearer-captured` message that a content script forwards to the service worker — is kept only as a best-effort fast path, never as the mechanism recovery depends on.

## Considered options

- **Push-only relay (the original design)** — rejected as the *sole* trigger. The interceptor runs in the page's MAIN world at `document_start` and posts the moment it sees a Bearer, but the content script that forwards the post only attaches its listener in the ISOLATED world at `document_idle`. The page's first authenticated `fetch` routinely fires in between, so the post is dropped and recovery never starts — the user sees a Reconnect button that does nothing until an unrelated later token refresh happens to re-fire the post. The startup fallback intended to cover this could never work: an isolated-world script cannot read the main-world `window.__devopsExtCapturedAuth` the interceptor writes. Kept as a *fast path* only, because when the timing does line up it recovers a few hundred ms sooner than waiting for tab load.
- **Pull on side-panel focus only** — rejected. Recovers only when the user returns to the panel, not when the reconnect tab finishes loading; worse UX and no background recovery.

## Consequences

- Recovery no longer depends on cross-world message timing. `readBearerFromTab` already crosses into the main world via `executeScript`, and its MSAL-cache fallback means a fresh token is found at `complete` even if the interceptor never captured one.
- The "exactly one automatic attempt, then manual Retry only" contract is replaced by "one attempt per reliable trigger." Each Azure DevOps tab finishing load is eligible for one recovery attempt; both recovery and manual **Retry** bypass the 5-min rotate throttle (the lazy `ensure` path still respects it). Bypassing is deliberate: the throttle records the timestamp *before* a Bearer is read, so a lazy ensure that fails for lack of a Bearer would otherwise block a genuine reconnect for up to 5 minutes — the original symptom. Storms are prevented structurally instead: an in-flight latch blocks concurrent triggers, and the first successful mint flips the status to connected so subsequent tab-loads no-op until the next expiry.
- Connection status is broadcast by `connectionService` only, but data-path mints through `authFetch` bypass it; the side panel therefore re-derives status from PAT validity on focus/visibility so the card cannot get stuck showing "disconnected" after a silent recovery.