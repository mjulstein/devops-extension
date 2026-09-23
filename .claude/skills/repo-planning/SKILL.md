---
name: repo-planning
description: Apply this repository's stable architectural constraints and planning checklist when drafting or reviewing an idea, spec, implementation plan, or task breakdown. Use when writing anything into specs/ or specs/ideas/, or when deciding whether a request is ready to promote from idea to numbered spec.
---

# Repo planning

Use when drafting or reviewing ideas, promoted specs, plans, or task breakdowns for
this repository.

## Stable Constraints To Apply

- Authenticate data calls with the **runtime-minted PAT**; use the browser session only to mint/rotate it. Never require a hand-created PAT, a backend/proxy, or committed secrets. (Superseded the older "no PATs at all" rule in [`specs/002-pat-auth-redesign`](../../../specs/002-pat-auth-redesign/spec.md).)
- Keep `src/content-script.ts` as a generic runtime message bridge.
- Place Azure DevOps-specific selectors, parsing, URL handling, and REST logic under `src/devops/`.
- Place sidepanel state, storage, and presentation orchestration under `src/sidepanel/`.
- Preserve the current service-worker and side-panel context flow, including last visited Azure DevOps context and pinned active work-item behavior.
- Keep runtime settings and persisted side-panel state browser-local and backwards-compatible when storage shapes evolve.
- Update `README.md`, `AGENTS.md`, and related `specs/` docs together when planning workflow, file structure, or user workflow changes.

## Planning Checklist

1. Confirm whether the request belongs in `specs/ideas/` or a numbered `specs/###-feature-name/` folder.
2. Check breadcrumbs and repo-relative links for any new Markdown documents.
3. Capture user-visible behavior, validation expectations, and storage implications explicitly.
4. Separate immediate scope from deferred follow-up work so later ideas can remain in `specs/ideas/`.
5. Keep plans implementation-aware without hardcoding environment-specific values such as org names, user names, or URLs.

## Key References

- [`docs/principles.md`](../../../docs/principles.md)
- [`AGENTS.md`](../../../AGENTS.md)
- [`CONTEXT.md`](../../../CONTEXT.md) — authentication vocabulary
- [`README.md`](../../../README.md)
- [`specs/README.md`](../../../specs/README.md)

