[root](./README.md) / AGENTS.md

# AGENTS.md

## Purpose

This file gives coding agents and contributors a compact, actionable guide for working in this repository.

## Project Summary

This repository contains a Microsoft Edge extension that fetches Azure DevOps work items for a configured user using the current authenticated browser session and displays them in a side panel.

The project uses Vite as the build system. Source files live under `src/`, and extension artifacts are generated into `dist/`.

## Source of Truth

- `README.md` is the human-facing project overview.
- `AGENTS.md` is the agent-facing execution guide.
- `.specify/memory/constitution.md` is the planning constitution for future spec work.
- `specs/` holds promoted feature specs, and `specs/ideas/` is the incubator for rough feature ideas before they are promoted.
- Markdown documentation should include a breadcrumb path link line at the top that points back to the repository root `README.md` and the current document path when practical (for example, `[root](./README.md) / AGENTS.md`). The root `README.md` itself is the exception and should not include a breadcrumb to itself.
- In breadcrumb text and navigation labels, treat directory `README.md` files as implied like an index page: show `src`, `src/devops`, or `types`, not `src/README.md`.
- Prefer repo-relative Markdown links for document navigation instead of plain path text when referencing other Markdown files.
- Source directories should include a local `README.md` that explains the directory purpose, summarizes the same-level files, and links to child directory docs instead of duplicating nested details inline.
- When project behavior, setup, configuration, file structure, or planning workflow changes, update `README.md`, `AGENTS.md`, and the relevant `.specify` / `specs` docs together in the same change whenever possible.
- If there is a mismatch, prefer aligning both files rather than updating only one.

## Working Agreement for Agents

- Keep changes minimal and targeted.
- Preserve the current architecture unless a change request requires restructuring.
- Keep the extension usable with the existing authenticated Azure DevOps session.
- Keep `src/content-script.ts` as a generic runtime message bridge; place Azure DevOps-specific selectors, parsing, and API/domain logic under `src/devops/` modules.
- Preserve the current service-worker/side-panel context flow: `src/service-worker.ts` records the last visited Azure DevOps org/project and work-item URLs in `chrome.storage.local`, and `src/sidepanel/App.tsx` can pin an active work-item context so work-item actions still work when the active tab is not Azure DevOps.
- Keep exploratory feature notes in `specs/ideas/` until goals, acceptance criteria, and sequencing are clear enough for a numbered feature spec.
- Do not add secrets, tokens, or committed local configuration.
- Side panel React component files should use `PascalCase.tsx`.
- Utility/function modules should use `camelCase.ts`.
- When moving or renaming tracked files, use `git mv` so history is preserved; do not create a new file and delete the old file as a substitute for a move.
- Run `npm run lint`, `npm test`, and `npm run build` after non-trivial changes.
- Prettier formatting issues are surfaced as ESLint warnings via `prettier/prettier`.

## Repository Map

- `.specify/README.md` + `.specify/{memory,templates}/*` — local Spec Kit memory and markdown templates for future planning work
- `specs/README.md` + `specs/ideas/README.md` — promoted feature spec workspace plus the rough-idea incubator
- `src/manifest.json` — extension manifest template copied to build output
- `src/service-worker.ts` — extension startup/background behavior
- `src/content-script.ts` — generic runtime message router between side panel and domain modules
- `src/devops/*` — Azure DevOps-specific DOM detection, URL/context parsing, REST/WIQL, and task/parent operations
- `src/devops/{activeParentContext,lastVisitedContext}.ts` — active work-item context resolution plus persisted last-visited org/project and work-item references used by the service worker fallback flow
- `src/devops/workItems.ts` — work-item query and transformation logic
- `src/sidepanel.html` — side panel HTML entry
- `src/sidepanel.tsx` — React side panel entry
- `src/sidepanel.css` — side panel styling
- `src/sidepanel/{App,Tabs,Link,DebugConsolePane}.tsx` — side panel state shell, tab chrome, link navigation helper, and in-panel debug log viewer
- `src/sidepanel/work-items/*` — work-items tab components (`StatusCard`, `WorkItemSection`) with `index.ts` entry export
- `src/sidepanel/work-item/*` — work-item tab components (`WorkItemCard`) with `index.ts` entry export
- `src/sidepanel/settings/*` — settings tab components (`SettingsCard`) with `index.ts` entry export
- `src/sidepanel/{chromeStorage,defaultSettings}.ts` — side panel storage/defaults helpers
- `src/sidepanel/tabMessaging/index.ts` + `src/sidepanel/tabMessaging/*.ts` — side panel tab messaging barrel + function modules
- `src/devops/*.test.ts` + `src/sidepanel/tabMessaging/*.test.ts` / `*.test.tsx` — Vitest unit tests (globals enabled)
- `types/*.ts` — shared extension types imported via the `@/types` alias
- `vite.config.ts` — Vite multi-entry build config for extension output
- `dist/` — generated unpacked extension files (build output)
- `README.md` — user/developer documentation
- `AGENTS.md` — agent instructions

## Configuration Rules

- Runtime settings should stay in browser storage unless explicitly changed.
- Persisted side-panel state in `src/sidepanel/chromeStorage.ts` (for example cached work items, hidden child-task state filters, parent suggestions, active tab, and pinned active work-item context) should remain browser-local and backwards-compatible when storage shapes or keys change.
- Local-only development configuration must not be committed.
- Avoid hardcoding organization, project, user names, tokens, or URLs that should remain configurable.
- Prefer deriving organization/project from the last visited `dev.azure.com/{organization}/{project}` URL when settings are empty.
- `organization`, `project`, and user-specific fields (for example `assignedTo`) may be persisted in settings as explicit overrides.

## Change Guidelines

When making changes:

1. Update only the files required for the task.
2. Preserve existing user-visible behavior unless the task requests a behavior change.
3. If UI text, setup steps, configuration, permissions, or workflow changes, review `README.md`.
4. If implementation conventions or agent instructions change, review `AGENTS.md`.
5. If either document becomes inaccurate because of the change, update both.
6. For file moves/renames, use `git mv` to keep file history and diffs clean.
7. When adding, moving, or restructuring Markdown documents, update their breadcrumb path links in the same change.
8. When adding a meaningful source directory, add or update its local `README.md` and keep parent directory docs linking to that child directory doc instead of expanding nested file lists inline.
9. When a planned feature changes scope or sequencing, update the relevant idea/spec artifacts in `specs/` before or with the implementation change.

## Validation Checklist

Before finishing a change, verify:

- The extension still loads as an unpacked Edge extension from `dist/`.
- Manifest entries remain consistent with the generated implementation.
- Side panel flow still works from the browser context.
- Azure DevOps requests still rely on the active authenticated session.
- Documentation reflects the current behavior and file structure.
- Linting passes with `npm run lint` (or intentionally reported warnings are explained).
- Tests pass with `npm test` (or intentionally reported failures are explained).

## Documentation Maintenance Rule

Any pull request or change that modifies one of the following should check and update both `README.md` and `AGENTS.md` as needed:

- project purpose
- setup/install steps
- configuration shape
- file structure
- extension permissions
- user workflow
- agent/contributor workflow
- markdown document navigation and breadcrumb conventions
- spec planning workflow or idea-to-spec promotion rules

## Non-Goals

Unless explicitly requested, do not:

- add backend services
- require personal access tokens
- add complex tooling for a small change
