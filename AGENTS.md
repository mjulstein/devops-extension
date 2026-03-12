# AGENTS.md

## Purpose

This file gives coding agents and contributors a compact, actionable guide for working in this repository.

## Project Summary

This repository contains a Microsoft Edge extension that fetches Azure DevOps work items for a configured user using the current authenticated browser session and displays them in a side panel.

The project uses Vite as the build system. Source files live under `src/`, and extension artifacts are generated into `dist/`.

## Source of Truth

- `README.md` is the human-facing project overview.
- `AGENTS.md` is the agent-facing execution guide.
- When project behavior, setup, configuration, or file structure changes, update `README.md` and `AGENTS.md` together in the same change whenever possible.
- If there is a mismatch, prefer aligning both files rather than updating only one.

## Working Agreement for Agents

- Keep changes minimal and targeted.
- Preserve the current architecture unless a change request requires restructuring.
- Keep the extension usable with the existing authenticated Azure DevOps session.
- Keep `src/content-script.ts` as a generic runtime message bridge; place Azure DevOps-specific selectors, parsing, and API/domain logic under `src/devops/` modules.
- Do not add secrets, tokens, or committed local configuration.
- Side panel React component files should use `PascalCase.tsx`.
- Utility/function modules should use `camelCase.ts`.
- When moving or renaming tracked files, use `git mv` so history is preserved; do not create a new file and delete the old file as a substitute for a move.
- Run `npm run lint`, `npm test`, and `npm run build` after non-trivial changes.
- Prettier formatting issues are surfaced as ESLint warnings via `prettier/prettier`.

## Repository Map

- `src/manifest.json` — extension manifest template copied to build output
- `src/service-worker.ts` — extension startup/background behavior
- `src/content-script.ts` — generic runtime message router between side panel and domain modules
- `src/devops/*` — Azure DevOps-specific DOM detection, URL/context parsing, REST/WIQL, and task/parent operations
- `src/devops/workItems.ts` — work-item query and transformation logic
- `src/sidepanel.html` — side panel HTML entry
- `src/sidepanel.tsx` — React side panel entry
- `src/sidepanel.css` — side panel styling
- `src/sidepanel/work-items/*` — work-items tab components (`StatusCard`, `WorkItemSection`) with `index.ts` entry export
- `src/sidepanel/work-item/*` — work-item tab components (`WorkItemCard`) with `index.ts` entry export
- `src/sidepanel/settings/*` — settings tab components (`SettingsCard`) with `index.ts` entry export
- `src/sidepanel/{chromeStorage,defaultSettings,types}.ts` — side panel utility modules
- `src/sidepanel/tabMessaging/index.ts` + `src/sidepanel/tabMessaging/*.ts` — side panel tab messaging barrel + function modules
- `src/sidepanel/tabMessaging/*.test.ts` / `*.test.tsx` — Vitest unit tests (globals enabled)
- `vite.config.ts` — Vite multi-entry build config for extension output
- `dist/` — generated unpacked extension files (build output)
- `README.md` — user/developer documentation
- `AGENTS.md` — agent instructions

## Configuration Rules

- Runtime settings should stay in browser storage unless explicitly changed.
- Local-only development configuration must not be committed.
- Avoid hardcoding organization, project, user names, tokens, or URLs that should remain configurable.
- Organization and project should be derived from the active Azure DevOps URL when possible; only user-specific fields (for example `assignedTo`) should be persisted in settings.

## Change Guidelines

When making changes:

1. Update only the files required for the task.
2. Preserve existing user-visible behavior unless the task requests a behavior change.
3. If UI text, setup steps, configuration, permissions, or workflow changes, review `README.md`.
4. If implementation conventions or agent instructions change, review `AGENTS.md`.
5. If either document becomes inaccurate because of the change, update both.
6. For file moves/renames, use `git mv` to keep file history and diffs clean.

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

## Non-Goals

Unless explicitly requested, do not:

- add backend services
- require personal access tokens
- add complex tooling for a small change
