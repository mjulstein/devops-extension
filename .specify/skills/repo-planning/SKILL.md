[root](../../../README.md) / [.specify](../../README.md) / [skills](../README.md) / repo-planning / SKILL.md

# Repo Planning Skill

Use this skill when drafting or reviewing ideas, promoted specs, plans, or task breakdowns for this repository.

## Stable Constraints To Apply

- Keep Azure DevOps access inside the authenticated browser session; do not require personal access tokens, backend services, or committed secrets.
- Keep `src/content-script.ts` as a generic runtime message bridge.
- Place Azure DevOps-specific selectors, parsing, URL handling, and REST logic under `src/devops/`.
- Place sidepanel state, storage, and presentation orchestration under `src/sidepanel/`.
- Preserve the current service-worker and side-panel context flow, including last visited Azure DevOps context and pinned active work-item behavior.
- Keep runtime settings and persisted side-panel state browser-local and backwards-compatible when storage shapes evolve.
- Update `README.md`, `AGENTS.md`, and related `.specify` / `specs` docs together when planning workflow, file structure, or user workflow changes.

## Planning Checklist

1. Confirm whether the request belongs in `specs/ideas/` or a numbered `specs/###-feature-name/` folder.
2. Check breadcrumbs and repo-relative links for any new Markdown documents.
3. Capture user-visible behavior, validation expectations, and storage implications explicitly.
4. Separate immediate scope from deferred follow-up work so later ideas can remain in `specs/ideas/`.
5. Keep plans implementation-aware without hardcoding environment-specific values such as org names, user names, or URLs.

## Key References

- [`.specify/memory/constitution.md`](../../memory/constitution.md)
- [`AGENTS.md`](../../../AGENTS.md)
- [`README.md`](../../../README.md)
- [`specs/README.md`](../../../specs/README.md)

