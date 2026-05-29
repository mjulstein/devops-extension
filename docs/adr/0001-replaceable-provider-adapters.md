---
status: accepted
date: 2026-05-29
---

# Backend integrations are replaceable provider adapters; authentication lives inside the adapter

The extension only integrates with Azure DevOps today, but we want to be able to fork it for other backends (Jira/Bitbucket) later with minimal blast radius. We therefore treat the generic core — side panel UI, service-worker message routing, and the work-item domain shape — as depending on a backend-agnostic **provider port**, with `src/devops/` as the one Azure DevOps **adapter** behind it. Crucially, the **entire authentication mechanism** — PAT lifecycle, main-world Bearer-token capture, any cookie handling — lives *inside* the adapter and is never visible to the core; the core sees only mechanism-free capabilities such as "fetch work items," "reconnect," and "connection status." A different backend becomes a different adapter, leaving the core untouched (Dependency Inversion + Open/Closed).

## Considered options

- **Auth as a separate, provider-agnostic port** — rejected. The only shared surface between, say, an Azure DevOps PAT and a Jira API token is "produce an authenticated request," which the data-fetch capabilities already imply. A dedicated auth port would abstract nothing real and would leak mechanism (tokens, rotation) into the core.
- **Keep provider-specific code in the generic shell (status quo)** — rejected. `mainWorldPatHandler` lived in `service-worker.ts`, welding Azure DevOps auth into provider-agnostic routing and making the fork boundary illegible.

## Consequences

- The PAT lifecycle moves out of `service-worker.ts` into the `src/devops/` adapter as small, single-responsibility units (transport / rotation policy / storage), per constitution Principle VII.
- The main-world step shrinks to the one thing that truly needs the page's main world: returning the captured Bearer token. The lifecycle runs in the service worker against `patLifecycle`, making it unit-testable and debuggable.
- The PAT settings UI (rotate, revoke, status) is itself provider-specific; long term it should be contributed by the provider rather than hardcoded in the generic `SettingsPane`.
- Backend-specific message types (e.g. `ROTATE_PAT`) should converge on generic ones (e.g. `RECONNECT`).
