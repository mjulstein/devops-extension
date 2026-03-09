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
- Do not add secrets, tokens, or committed local configuration.
- Side panel React component files should use `PascalCase.tsx`.
- Utility/function modules should use `camelCase.ts`.

## Repository Map

- `src/manifest.json` — extension manifest template copied to build output
- `src/service-worker.ts` — extension startup/background behavior
- `src/content-script.ts` — Azure DevOps page interaction and REST/WIQL calls
- `src/content/functions/workItems.ts` — work-item query and transformation logic
- `src/sidepanel.html` — side panel HTML entry
- `src/sidepanel.tsx` — React side panel entry
- `src/sidepanel.css` — side panel styling
- `src/sidepanel/components/*` — side panel React components
- `src/sidepanel/functions/*` — side panel utility modules
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

## Validation Checklist

Before finishing a change, verify:

- The extension still loads as an unpacked Edge extension from `dist/`.
- Manifest entries remain consistent with the generated implementation.
- Side panel flow still works from the browser context.
- Azure DevOps requests still rely on the active authenticated session.
- Documentation reflects the current behavior and file structure.

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
