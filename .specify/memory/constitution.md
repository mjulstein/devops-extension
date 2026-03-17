[root](../../README.md) / [.specify](../README.md) / [memory](./README.md) / constitution.md

# DevOps Extension Constitution

## Core Principles

### I. Browser-Session Azure DevOps Access
All Azure DevOps reads and writes must continue to rely on the authenticated browser session. Features must not require personal access tokens, backend proxies, or committed credentials unless the repository direction changes explicitly.

### II. Clear Extension Boundaries
`src/content-script.ts` remains a generic runtime message bridge. Azure DevOps-specific DOM selectors, URL parsing, and REST logic belong in `src/devops/`. Side panel state, storage, and presentation concerns belong in `src/sidepanel/`.

### III. Preserve Active Context Flow
The service worker and side panel must preserve the current fallback flow: last visited Azure DevOps org/project and work-item references are stored in `chrome.storage.local`, and the side panel can pin an active work-item context so work-item actions still work when the active tab is not Azure DevOps.

### IV. Browser-Local Configuration And State
Runtime settings and side-panel state should stay browser-local unless a deliberate design change says otherwise. Storage changes must remain backwards-compatible where practical so saved settings, cached results, hidden task filters, parent suggestions, and pinned context continue to hydrate cleanly.

### V. Documentation-First Planning
Before a feature grows beyond a rough note, its scope, acceptance criteria, and implementation sequencing should be captured in Spec Kit artifacts. Markdown navigation, breadcrumbs, and directory docs must stay aligned so contributors and agents can move from root docs to feature docs predictably.

## Technical Constraints

- Platform baseline: Microsoft Edge Manifest V3 extension built with Vite, React, and TypeScript.
- Authentication guardrail: use the active authenticated Azure DevOps browser session.
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

**Version**: 1.0.0 | **Ratified**: 2026-03-16 | **Last Amended**: 2026-03-16

