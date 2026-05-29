[root](../../README.md) / [specs](../README.md) / 002-pat-auth-redesign / spec.md

# Feature Specification: PAT-Based Authentication Redesign

**Feature Branch**: `[002-pat-auth-redesign]`
**Created**: 2026-05-29
**Status**: Planned
**Input**: Replace fragile browser-session (cookie/Bearer) authentication for Azure DevOps data calls with a runtime-minted, auto-rotating Personal Access Token, so the extension keeps working through the office tenant's frequent ENTRA access-token failures. Establishes the credential as an Azure-DevOps-specific concern inside a replaceable provider adapter.

**Related docs**: [constitution](../../.specify/memory/constitution.md) (Principles I, VI, VII), [ADR-0001](../../docs/adr/0001-replaceable-provider-adapters.md), [CONTEXT.md](../../CONTEXT.md)

## User Scenarios & Testing

### User Story 1 - Work through an ENTRA wobble without re-authenticating (Priority: P1)

The user reads and edits work items from the side panel. The Azure DevOps Bearer token in their open tab silently expires (≈hourly) and the office tenant fails to renew it. Previously this dumped them on a "sign out" error page until they manually cleared cookies. Now their side-panel actions keep working, because data calls authenticate with the extension's own PAT, not the browser session.

**Why this priority**: This is the entire reason for the redesign. Without it the extension is unreliable several times a day.

**Independent Test**: With a valid PAT in storage, let the page's Bearer token expire (or remove it), then perform a work-item read and a write from the side panel; both succeed without any sign-in interaction.

**Acceptance Scenarios**:

1. **Given** a valid PAT exists, **When** the user fetches work items, **Then** the request is sent with `Authorization: Basic` (PAT) and `credentials` omitted, and succeeds regardless of cookie/Bearer state.
2. **Given** a valid PAT exists, **When** the user creates a child task or sets a parent, **Then** the write succeeds using the PAT.
3. **Given** the PAT has been rejected (401), **When** a data call is made, **Then** the extension attempts one rotation and retries, and never falls back to cookie auth.

### User Story 2 - Reconnect cleanly when the session is truly down (Priority: P1)

The PAT has expired and the extension cannot mint a new one because no fresh Bearer token is available (no Azure DevOps tab, or the captured token is stale). The side panel tells the user it needs to reconnect and offers a link to open a new Azure DevOps tab, where any SSO/ENTRA prompt appears on a tab the user controls.

**Why this priority**: A trustworthy failure state is as important as the happy path; silent no-ops were the original bug.

**Independent Test**: With no valid PAT and no fresh Bearer available, open the side panel; verify all data actions are blocked and a "Open Azure DevOps to reconnect" link is shown. Open the link, complete sign-in; verify the panel recovers automatically.

**Acceptance Scenarios**:

1. **Given** no valid PAT and no fresh Bearer, **When** the side panel renders, **Then** it shows **Reconnect needed**, blocks all data requests, and shows a link to `https://dev.azure.com/{org}` opened in a new tab.
2. **Given** the user opened a new Azure DevOps tab and a fresh Bearer is captured, **When** the capture occurs, **Then** the extension attempts exactly one automatic rotation and, on success, unblocks the panel.
3. **Given** that one automatic rotation fails, **When** the failure is reported, **Then** the panel stops auto-retrying and shows a manual **Retry** control.
4. **Given** a stale (expired-per-`exp`) Bearer token is the only one available, **When** a rotation would fire, **Then** the extension does not fire it and treats the state as **Reconnect needed**.

### User Story 3 - One tidy, auto-rotating credential (Priority: P2)

The user does nothing to manage the credential. A fresh PAT is minted on first use each working day, and the Azure DevOps token registry shows a single active `{deviceId}-devopsext` entry whose secret value changes on rotation.

**Why this priority**: Zero-touch lifecycle and a clean registry are the usability payoff once the core auth works.

**Independent Test**: On a new day, open the side panel; verify a new PAT secret is minted, the previous one is revoked, and the display name stays `{deviceId}-devopsext`.

**Acceptance Scenarios**:

1. **Given** the stored PAT has <12h validity remaining and a fresh Bearer is available, **When** an ensure-valid check runs, **Then** the extension mints a new token value, stores it, and revokes the previous one.
2. **Given** a fresh PAT was just minted, **When** the user views the Azure DevOps tokens page, **Then** exactly one active `{deviceId}-devopsext` entry exists (older ones are revoked and age out on their own).
3. **Given** a valid PAT with >12h remaining, **When** ensure-valid runs, **Then** no rotation occurs.

## Edge Cases

- No Azure DevOps tab is open when a mint/rotation is needed → **Reconnect needed** with the open-tab link.
- A captured Bearer exists but is expired per its `exp` claim → treated as no fresh Bearer; never fired.
- Rotation `POST` succeeds but the `DELETE` of the old token fails → new token is authoritative; the old one is left to expire (acceptable lingering entry).
- Background rotation fails while the current PAT is still valid → remain **Connected**; retry on the next ensure-valid, subject to the `lastRotateAttemptAt` throttle.
- Organization not yet resolved (no last-visited context and no override) → the side panel cannot target an org; surface the existing "open a project / set overrides" guidance.
- Multiple devices/profiles → each has its own `deviceId`, hence its own `{deviceId}-devopsext` entry.

## Requirements

### Functional Requirements

- **FR-001**: Data-API calls MUST authenticate with the runtime PAT via `Authorization: Basic` and `credentials` omitted; cookie auth MUST NOT be used for data calls.
- **FR-002**: The extension MUST mint and rotate the PAT by calling the PAT Lifecycle API with a Bearer token captured from an active Azure DevOps tab's main world.
- **FR-003**: Before firing any PAT-API request, the extension MUST confirm the Bearer token is fresh by decoding its JWT `exp` claim with a few minutes of headroom; a stale token MUST NOT be fired.
- **FR-004**: A PAT MUST be issued with ~24h validity and rotated when <12h remains. Rotation MUST create a new token value and revoke the previous one (Azure DevOps "Regenerate"); the `PUT`/Extend operation MUST NOT be used.
- **FR-005**: PAT validity MUST be ensured lazily — when the side panel opens and before any data operation — and MUST NOT rely on `chrome.runtime.onStartup` or a scheduler.
- **FR-006**: Rotation attempts MUST be throttled via a stored `lastRotateAttemptAt` so a failing rotation does not retry on every interaction.
- **FR-007**: When no valid PAT exists and one cannot be minted, the side panel MUST enter **Reconnect needed**, block all data requests, and present a link that opens `https://dev.azure.com/{org}` in a new tab.
- **FR-008**: On capture of a fresh Bearer after a reconnect, the extension MUST attempt exactly one automatic rotation; on failure it MUST stop automatic retries and present a manual **Retry** control.
- **FR-009**: Connection status MUST be derived from PAT validity (no separate persisted flag) and communicated to the side panel so the UI reflects changes without a manual reload.
- **FR-010**: All Azure DevOps authentication logic (PAT lifecycle, Bearer capture, connection status) MUST live in the `src/devops/` adapter as small, single-responsibility units; `src/service-worker.ts` MUST remain a generic message router (constitution VI/VII).
- **FR-011**: The code injected into the page's main world MUST be reduced to returning the captured Bearer token; the PAT lifecycle MUST run in the service worker against the adapter and be unit-testable.
- **FR-012**: The manual "Clear DevOps Cookies" feature MUST be removed, along with the `cookies` manifest permission and the cookie fallback in `authFetch`.
- **FR-013**: The PAT display name MUST be `{deviceId}-devopsext` and stay stable across rotations.
- **FR-014**: Backend-specific runtime messages (e.g. `ROTATE_PAT`) SHOULD converge toward a generic `RECONNECT` capability, as a step toward the provider port in ADR-0001.

### Key Entities

- **PatRecord**: The stored credential — `token` (the secret), `authorizationId`, `expiresAt`, `displayName`. Persisted in `chrome.storage.local`.
- **Device ID**: An 8-char hex id naming the **Extension PAT** for this browser profile.
- **Bearer token**: The transient MSAL access token captured from the page, used only to mint/rotate the PAT, and only while fresh.
- **Connection status**: A derived state — Connected / Reconnect needed — gating side-panel actions.

## Success Criteria

### Measurable Outcomes

- **SC-001**: With a valid PAT, a user completes work-item reads and writes across an Azure DevOps Bearer-token expiry without ever seeing the "sign out" error page.
- **SC-002**: During normal operation the Azure DevOps tokens page shows exactly one *active* `{deviceId}-devopsext` entry.
- **SC-003**: When the session is genuinely down, the side panel clearly signals **Reconnect needed** and recovers automatically after the user opens an Azure DevOps tab, or via a single **Retry** click.
- **SC-004**: The PAT rotation-policy logic is covered by unit tests that depend on neither `chrome` APIs nor `fetch`.
