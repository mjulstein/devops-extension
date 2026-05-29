[root](../../README.md) / [.specify](../README.md) / [memory](./README.md) / constitution.md

# DevOps Extension Constitution

## Core Principles

### I. Self-Contained, Runtime-Acquired Credentials
The extension must not commit or ship any credentials, secrets, or tokens, and must not depend on an external backend or proxy server. All authentication material must be acquired dynamically at runtime, rooted in the user's authenticated Azure DevOps browser session, and stored browser-local in `chrome.storage.local`. A Personal Access Token that is generated at runtime from the active browser session and auto-rotated is permitted under this principle; a committed PAT, a hardcoded secret, or a server-side token broker is not.

Rationale: the office ENTRA (Azure AD) SSO session is unreliable and forces re-authentication several times a day, breaking every API call that rides on the cookie session. A runtime-minted PAT gives the extension a stable credential that survives ENTRA wobbles, while keeping the repo free of secrets.

### II. Clear Extension Boundaries
`src/content-script.ts` remains a generic runtime message bridge. Azure DevOps-specific DOM selectors, URL parsing, and REST logic belong in `src/devops/`. Side panel state, storage, and presentation concerns belong in `src/sidepanel/`.

### III. Preserve Active Context Flow
The service worker and side panel must preserve the current fallback flow: last visited Azure DevOps org/project and work-item references are stored in `chrome.storage.local`, and the side panel can pin an active work-item context so work-item actions still work when the active tab is not Azure DevOps.

### IV. Browser-Local Configuration And State
Runtime settings and side-panel state should stay browser-local unless a deliberate design change says otherwise. Storage changes must remain backwards-compatible where practical so saved settings, cached results, hidden task filters, parent suggestions, and pinned context continue to hydrate cleanly.

### V. Documentation-First Planning
Before a feature grows beyond a rough note, its scope, acceptance criteria, and implementation sequencing should be captured in Spec Kit artifacts. Markdown navigation, breadcrumbs, and directory docs must stay aligned so contributors and agents can move from root docs to feature docs predictably.

### VI. Replaceable Backend Providers
The extension targets Azure DevOps today but the integration must stay replaceable (for example, a future Jira/Bitbucket fork). Generic code — the side panel UI, the service-worker message router, and the work-item domain shape — must depend on a backend-agnostic provider port, never on backend-specific details. All Azure DevOps specifics, including the **entire authentication mechanism** (PAT lifecycle, main-world Bearer-token capture, any cookie handling), live inside the `src/devops/` adapter and are exposed to the generic core only through mechanism-free capabilities (fetch work items, reconnect, connection status). Swapping providers should mean replacing one adapter, with no change to the generic core. See [ADR-0001](../../docs/adr/0001-replaceable-provider-adapters.md).

### VII. Small, Single-Responsibility Units
Source files stay as small as their single responsibility allows. Prefer decomposing into nested modules over growing a file: transport, policy, storage, and presentation are separate units. A unit should have one reason to change, and provider-specific logic should be legible file-by-file so a fork can see exactly what to replace.

## Technical Constraints

- Platform baseline: Microsoft Edge Manifest V3 extension built with Vite, React, and TypeScript.
- Authentication guardrail: data-API calls authenticate only with a runtime-minted PAT (Basic auth, credentials omitted). The browser session is used solely to obtain a **fresh** Bearer token from an active Azure DevOps tab in order to mint or rotate the PAT. A stale Bearer token must never be fired, as presenting an expired token can break the session (the "sign out" error page).
- Configuration guardrail: do not hardcode organization, project, user names, secrets, or environment-specific URLs that should remain configurable.
- Documentation guardrail: keep `README.md`, `AGENTS.md`, directory docs, and relevant spec artifacts aligned when workflow or file structure changes.
- Quality baseline: non-trivial implementation changes should still pass `npm run lint`, `npm test`, and `npm run build`.

## Workflow And Quality Gates

- Incubate rough feature ideas in `specs/ideas/` before promoting them into numbered feature spec folders.
- Promote an idea only when goals, acceptance scenarios, and sequencing are clear enough to justify a spec.
- Each promoted feature should start with `specs/###-feature-name/spec.md` and add `plan.md` / `tasks.md` when planning work moves beyond the idea stage.
- Reviews should reject changes that break the authenticated-session workflow, blur the `src/devops/` and `src/sidepanel/` boundary without reason, or leave docs/spec artifacts inconsistent with implementation.

## Governance

This constitution guides future spec work in this repository. Amendments should update this file together with any affected `README.md`, `AGENTS.md`, or spec artifacts so the planning workflow stays internally consistent.

**Version**: 2.1.0 | **Ratified**: 2026-03-16 | **Last Amended**: 2026-05-29

