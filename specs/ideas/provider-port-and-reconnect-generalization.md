[root](../../README.md) / [specs](../README.md) / [ideas](./README.md) / provider-port-and-reconnect-generalization

# Provider port + reconnect generalization

Deferred follow-up work split out of [`specs/002-pat-auth-redesign`](../002-pat-auth-redesign/spec.md). These were intentionally left out of scope when the PAT redesign shipped; capture them here so they are not lost.

## Value

The 002 redesign moved all Azure DevOps auth into the `src/devops/auth/` adapter and kept `src/service-worker.ts` generic, as a first step toward the replaceable provider port described in [ADR-0001](../../docs/adr/0001-replaceable-provider-adapters.md). Two pieces of that direction were deferred.

## Deferred items

1. **Generic `RECONNECT` capability (spec FR-014).** Backend-specific runtime messages (`ROTATE_PAT`, `ENSURE_CONNECTION`, `RETRY_CONNECTION`, `REVOKE_ALL_EXTENSION_PATS`, `DEVOPS_BEARER_CAPTURED`) should converge toward a small provider-agnostic capability surface (e.g. a generic `RECONNECT` / `ENSURE_CREDENTIAL` contract) so a non-Azure-DevOps provider could satisfy the same side-panel connection-status UI without bespoke message types.
2. **Provider-contributed settings UI.** The Settings pane currently hard-codes the PAT status/rotate/revoke controls. A replaceable provider should be able to contribute its own credential-management UI fragment rather than the side panel knowing about PATs directly.

## Open questions

- What is the minimal credential/connection port interface that both a PAT-based and a cookie/OAuth-based provider could implement?
- Does the provider own its settings UI fragment, or does it expose declarative metadata the generic Settings pane renders?

## Promotion criteria

Promote when a second provider (or a concrete need to swap the Azure DevOps adapter) makes the port's shape concrete enough to design against, rather than speculatively.
