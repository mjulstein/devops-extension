# DevOps Extension

A Microsoft Edge / Chrome MV3 extension that surfaces Azure DevOps work items in a side panel and lets the user act on them. This glossary fixes the language around how the extension authenticates to Azure DevOps.

## Language

### Authentication

**Browser session**:
The user's authenticated Azure DevOps session in the tab — cookies plus the in-page MSAL token cache. The root of trust: everything else is bootstrapped from it. Unreliable in the office tenant (see **Bearer token**).
_Avoid_: login, cookies (as a synonym for the whole session)

**Bearer token**:
The short-lived (≈1h) MSAL access token the Azure DevOps web app uses for its own API calls. Lives only in the page's main-world JS heap; the extension can't read it directly. Silent renewal fails often in the office tenant — the daily breakage the PAT exists to route around. The extension only ever fires a PAT-API request with a Bearer token it has confirmed is **fresh** (decoding the JWT `exp` claim, requiring a few minutes of headroom); presenting a stale Bearer can break the session.
_Avoid_: access token, MSAL token, auth token

**PAT** (Personal Access Token):
The long-lived secret the extension mints at runtime and sends as HTTP Basic auth on its data-API calls, decoupling them from the flaky **Bearer token**. The PAT *is* the secret value (the `token` string). Stored only in `chrome.storage.local`, never in the repo.
_Avoid_: API key, token (unqualified), secret

**Extension PAT**:
The single active **PAT** this extension owns, identified in the Azure DevOps **token registry** by the stable display name `{deviceId}-devopsext`.

**Device ID**:
An 8-character random hex id generated once and persisted in `chrome.storage.local`. Names the **Extension PAT** so one browser profile maps to one recognizable token entry.

### PAT lifecycle

**Rotate**:
Replace the **Extension PAT**'s secret value: `POST` a new token, store it, then `DELETE` (revoke) the previous one. A new secret necessarily gets a new `authorizationId` — Azure DevOps has no in-place value swap — so only the display name stays stable. This is the *only* refresh operation the extension uses. Runs ~once per working day (24h lifetime, triggered when <12h remains).
_Avoid_: renew, regenerate-in-place

**Extend** (Azure DevOps `PUT validTo`):
Push out a PAT's expiry while keeping the same secret value and `authorizationId` (the `PUT` response returns `token: null`). A real Azure DevOps operation the extension deliberately does **not** use, because it never changes the secret.
_Avoid_: renew, prolong

**Token registry**:
The user's list of PATs in Azure DevOps (`vssps.dev.azure.com/.../_apis/tokens/pats`, shown on the tokens page). Because **Rotate** always creates a new entry and revoked entries linger as inactive rows for months before Azure DevOps auto-removes them, the registry shows one *active* `…-devopsext` plus a self-clearing tail of revoked ones. Only the active one is usable.

### Connection state

The provider-agnostic status the side panel reads to decide whether it can act. **Derived** from PAT validity — never a separately stored flag.

**Connected**:
A valid **PAT** exists. All data requests are allowed.

**Reconnect needed**:
No valid **PAT** and one cannot be minted right now (no fresh **Bearer token**, no Azure DevOps tab, or a failed rotation). All data requests from the side panel are blocked and a **Reconnect** affordance is shown.

**Reconnect**:
The recovery action: open a *new* Azure DevOps tab (`dev.azure.com/{org}`) so the user can complete any SSO/ENTRA prompt on a tab they control, letting the interceptor capture a fresh **Bearer token**. Exactly **one** automatic rotation is attempted when that fresh token is captured; if it fails, recovery falls back to a manual **Retry** button with no further automatic attempts.
_Avoid_: re-login, refresh, sign-in

## Flagged ambiguities

- **"Renew"** was used early on to mean both *Extend* (same value, later expiry) and *Rotate* (new value). These are different Azure DevOps operations with different security properties. Resolution: the extension always **Rotates**; it never **Extends**. Avoid the word "renew".
- **"Regenerate"** (the Azure DevOps UI button) looks like an in-place value swap but is not: it is `create new + delete old`, reusing only the display name. There is no API that returns a new secret for an existing `authorizationId`.
- **"Key"** — "the key in the registry stays the same" refers to the stable **display name**, not the `authorizationId` (which changes every Rotate) nor the `chrome.storage.local` key.

## Example dialogue

> **Dev:** When the PAT gets old, do we renew it?
> **Expert:** Don't say renew — it's ambiguous. We *rotate*: mint a brand-new secret value and revoke the old one. We never *extend*, which would keep the same secret and just move the expiry out.
> **Dev:** Can't we regenerate the same entry in place, like the UI button?
> **Expert:** No — even the UI button is create-new-then-delete-old under the hood. A new secret is always a new `authorizationId`. We keep the *display name* stable and revoke the old one, so the registry shows one active `…-devopsext` and a tail of revoked rows that age out on their own.
> **Dev:** And the data calls use that PAT, not the bearer token?
> **Expert:** Right. The bearer token is read once, in the page's main world, only to mint the PAT. After that every data call uses the PAT over Basic auth, so a bearer-token wobble doesn't touch us.
