[root](./README.md) / AGENTS.md

# AGENTS.md

## Purpose

This file gives coding agents and contributors a compact, actionable guide for working in this repository.

## Project Summary

This repository contains a Microsoft Edge extension that fetches Azure DevOps work items for a configured user and displays them in a side panel. Data calls authenticate with a runtime-minted, auto-rotating Personal Access Token (PAT); the browser's authenticated session is used only to mint that PAT. See [`CONTEXT.md`](./CONTEXT.md) and [`specs/002-pat-auth-redesign`](./specs/002-pat-auth-redesign/spec.md).

The project uses Vite as the build system. Source files live under `src/`, and extension artifacts are generated into `dist/`.

## Source of Truth

- `README.md` is the human-facing project overview.
- `AGENTS.md` is the agent-facing execution guide.
- `CLAUDE.md` is the Claude Code entry point; it imports `AGENTS.md` and adds no duplicate rules, so `AGENTS.md` stays the single source of truth for agent guidance.
- `docs/principles.md` holds the non-negotiable project principles; `docs/adr/` holds architecture decision records.
- `.claude/skills/` holds this repo's agent skills: `repo-planning` (spec/plan work) and `sidepanel-dev-harness` (side-panel UI iteration).
- `specs/` holds promoted feature specs, and `specs/ideas/` is the incubator for rough feature ideas before they are promoted.
- Markdown documentation should include a breadcrumb path link line at the top that points back to the repository root `README.md` and the current document path when practical (for example, `[root](./README.md) / AGENTS.md`). The root `README.md` itself is the exception and should not include a breadcrumb to itself.
- In breadcrumb text and navigation labels, treat directory `README.md` files as implied like an index page: show `src`, `src/devops`, or `types`, not `src/README.md`.
- Prefer repo-relative Markdown links for document navigation instead of plain path text when referencing other Markdown files.
- Source directories should include a local `README.md` that explains the directory purpose, summarizes the same-level files, and links to child directory docs instead of duplicating nested details inline.
- When project behavior, setup, configuration, file structure, or planning workflow changes, update `README.md`, `AGENTS.md`, and the relevant `docs/` / `specs/` files together in the same change whenever possible.
- If there is a mismatch, prefer aligning both files rather than updating only one.

## Working Agreement for Agents

- Keep changes minimal and targeted.
- Preserve the current architecture unless a change request requires restructuring.
- Keep the extension usable through frequent Azure DevOps Bearer-token expiry: data calls use the runtime PAT, never cookie auth.
- Keep `src/content-script.ts` as a generic runtime message bridge; place Azure DevOps-specific selectors, parsing, and API/domain logic under `src/devops/` modules.
- Keep all Azure DevOps authentication (PAT lifecycle, Bearer capture, connection status) inside the `src/devops/auth/` adapter; `src/service-worker.ts` stays a generic message router. The only code that runs in the page's main world is the one-line Bearer read in `readBearerFromTab.ts` plus the passive `token-interceptor.ts`.
- Preserve the current service-worker/side-panel context flow: `src/service-worker.ts` records the last visited Azure DevOps org/project and work-item URLs in `chrome.storage.local`, and `src/sidepanel/App.tsx` can pin an active work-item context so work-item actions still work when the active tab is not Azure DevOps.
- Keep exploratory feature notes in `specs/ideas/` until goals, acceptance criteria, and sequencing are clear enough for a numbered feature spec.
- Do not add secrets, tokens, or committed local configuration.
- Prefer the `dev/` harness (`npm run dev:panel`) for side-panel UI work; it needs no extension build or reload. It serves fixtures only and never calls Azure DevOps, so verify data-dependent behavior by loading `dist/` as an unpacked extension.
- Side panel React component files should use `PascalCase.tsx`.
- Side panel React component styles should live beside their components in `ComponentName.module.css` files and be imported as `import classes from './ComponentName.module.css';`; when an element needs multiple classes, use `clsx` to compose them in JSX.
- Side panel sections may add local `atoms/` subdirectories for reusable interactive concepts and colocated `*.test.ts` / `*.test.tsx` coverage; keep section layout files focused on composition rather than repeated row/button/control behavior.
- Prefer moving side-panel stateful orchestration into section-local hooks or controller modules (for example `useSidepanelController.ts`) so `App.tsx` and card/layout components stay thin.
- Utility/function modules should use `camelCase.ts`.
- When moving or renaming tracked files, use `git mv` so history is preserved; do not create a new file and delete the old file as a substitute for a move.
- Run `npm run lint`, `npm test`, and `npm run build` after non-trivial changes.
- Respect the repository formatting rules in `.prettierrc` and keep committed text files on LF line endings per `.editorconfig` and `.gitattributes`.
- Prettier formatting issues are surfaced as ESLint warnings via `prettier/prettier`; avoid manual formatting that introduces warnings like `Delete ␍`, `Insert ··`, or indentation replacement diffs.

## Repository Map

- `docs/principles.md` + `docs/adr/*` — project principles and architecture decision records
- `.claude/skills/*` — repo agent skills (`repo-planning`, `sidepanel-dev-harness`)
- `specs/README.md` + `specs/ideas/README.md` — promoted feature spec workspace plus the rough-idea incubator
- `dev/README.md` + `dev/*` — side-panel dev harness: runs the real `App` against a fake `chrome` global under Vite for UI work without an extension build/reload (mock data only)
- `src/manifest.json` — extension manifest template copied to build output
- `src/service-worker.ts` — extension startup/background behavior
- `src/content-script.ts` — generic runtime message router between side panel and domain modules
- `src/devops/*` — Azure DevOps-specific DOM detection, URL/context parsing, REST/WIQL, and task/parent operations
- `src/devops/authFetch.ts` — PAT-only Azure DevOps fetch wrapper (HTTP Basic, `credentials: 'omit'`); rotates once and retries on `401`, then throws `ReconnectNeededError`
- `src/devops/auth/*` — the auth adapter (PAT scope is `vso.work_write vso.code vso.settings_write`; the settings scope is what lets the panel read and set Azure DevOps's own theme, and widening the list rotates every existing PAT. An organization may forbid a scope: creation then retries with `PAT_CORE_SCOPE` and marks the record `scopeFallback`, so the extension keeps working without that feature and without minting a replacement token on every call): `rotationPolicy` (use/rotate/reconnect), `bearerToken` (JWT `exp` freshness), `patStore` (storage), `patApi` (PAT Lifecycle transport), `ensurePat` (orchestration + throttle), `readBearerFromTab` (one-line main-world Bearer read), `connectionStatus`/`connectionService` (derived status + auto-once-then-manual reconnect)
- `src/token-interceptor.ts` — main-world `document_start` script that captures the page's Bearer token and signals fresh captures for auto-recovery
- `src/devops/{activeParentContext,lastVisitedContext}.ts` — active work-item context resolution plus persisted last-visited org/project and work-item references used by the service worker fallback flow
- `src/devops/workItems.ts` — separate open/closed work-item query and transformation logic, including closed-date range filtering and parent-summary enrichment
- `src/bookmarks.html` + `src/bookmarks.tsx` + `src/bookmarks/*` — the extension's own bookmark manager page, which the palette's **Bookmarks** button opens in place of the browser's. The browser's manager cannot show what is saved twice or what is now empty, which is most of the reason it gets opened; the page is split two thirds drag-and-drop organiser to one third **Duplicate name** / **Duplicate path** / **Duplicate folder** / **Empty folders** lists, and every row carries edit, delete and move-to-folder in place. Selecting a folder in the tree scopes all four lists to that subtree, since a duplicate matters where you are working. Duplicate *path* compares urls without their search params and only reports copies in different folders, since two in one folder are already visible side by side; duplicate *folder* rows rename and move but never delete, because such a folder may be full. See [`src/bookmarks/README.md`](./src/bookmarks/README.md)
- `src/sidepanel.html` — side panel HTML entry
- `src/sidepanel.tsx` — React side panel entry
- `src/sidepanel/{App,Tabs,Link,DebugConsolePane}.tsx` + matching `*.module.css` files — side panel shell, tab chrome, link navigation helper, and in-panel debug log viewer
- `src/sidepanel/navigateToWorkItem.ts` — shared Azure DevOps work-item navigation helper used by links and task buttons to reuse matching tabs when possible
- `src/sidepanel/{atoms,useSidepanelController}.ts*` — shared shell atoms (including the one `SectionTabs` strip every tabbed region uses) plus the side-panel orchestration hook used by `App.tsx`
- `src/favoritesPalette/faviconData.ts` — site icons for the palette, read by the service worker and passed in as data URIs, since an extension resource (which the browser's favicon cache is) cannot be loaded from a page. Keyed and cached by origin: one icon serves every board and work item on an organization
- `src/favoritesPalette/*` — the favorites palette drawn over an Azure DevOps page by the content script when the shortcut is pressed. It is centred where the user is looking, and the page's document already has focus so its search field can simply take it; off Azure DevOps the shortcut falls back to the side panel's own menu. Both the shortcut and the panel's own trigger route through one `openFavoritesSearch` in the service worker so they cannot disagree about where the search opens, and a tab whose content script predates the last extension reload gets one injected rather than being asked to refresh. Its shadow root isolates layout but deliberately lets Azure DevOps's CSS custom properties through, so the dialog follows the page's theme
- `src/sidepanel/themeTokens.ts` — reads both palettes out of the loaded stylesheet via CSSOM, so the settings editor never restates them; stores only tokens that differ from their default, and applies those as inline custom properties on the document element
- `src/theme.css` + `src/sidepanel/theme.ts` — the one place colour is defined: semantic tokens for light and dark, switched by `data-theme` on the document element, plus `color-scheme` and base rules for form controls and links so the browser's own widgets and anything a CSS module does not style follow the theme too. Both palettes meet WCAG 2.2 AA (SC 1.4.3 for text, 1.4.11 for borders); `temp/cdp-audit-contrast.py` audits the rendered panel. Every CSS module resolves its colours through these tokens, so no hex literal should be added back to a stylesheet. The last known theme is cached browser-locally only so the panel does not flash light on open, alongside the resolved token values the favorites palette needs (the service worker opens it and has no document to compute them from)
- `src/devops/pageTheme.ts` — Azure DevOps's colours read from the page's own computed custom properties, mapping each panel token to the page variables it should follow. Partial on purpose: a token with no sensible counterpart keeps its default, because a wrong colour is worse than the built-in one
- `src/devops/theme.ts` — reads and writes Azure DevOps's own theme setting, so the panel mirrors it rather than keeping a second preference that can drift. The settings entry key and its theme ids are Azure DevOps's own and undocumented; an unreadable value leaves the switch disabled rather than guessing
- `src/sidepanel/activeTabDiagnostics.ts` — what the panel can read of the active tab and whether it counts as Azure DevOps. Starring a page and drawing the palette over it both hinge on that answer, and an unexpected "no" is otherwise invisible
- `src/sidepanel/shortcutDiagnostics.ts` — reads the keys `chrome.commands` actually bound for the favorites shortcut, and describes the last recorded keypress (`lastShortcutRun`, written by the service worker and mirrored into the panel's debug console as it changes, since the worker's own console is somewhere nobody looks) so a bound-but-silent shortcut can be told apart from one that never fires. A `suggested_key` that clashes with a browser shortcut is left unbound silently, and browsers differ on what they reserve, so the manifest is not evidence of what works
- `src/sidepanel/favoriteIcon.ts` — favorite icons read from the browser's favicon cache through the `favicon` permission's `_favicon/` endpoint, so nothing is captured at star time and a favorite adopted from a synced bookmark gets an icon on the same terms
- `src/sidepanel/quickTaskBookmarks.ts` — mirrors the in-progress quick tasks into a sub-folder of the favorites folder, keyed on the task url and titled with the task's own name. Runs only once a Quick-tab fetch completes, because the folder mirrors what was fetched and a partial list would delete bookmarks for live work. A task that finishes, is cancelled, or stops being returned has its bookmark deleted: the folder is a working set, not a history. They are real bookmarks, so they reach machines with no extension installed
- `src/sidepanel/favoritesListing.ts` + `src/sidepanel/favoritesQuery.ts` + `src/sidepanel/bookmarkFolders.ts` — how the favorites list is sectioned and searched: chosen favorites first, open quick tasks after them behind a divider, and a leading `.` widening the same box to the browser's own bookmarks. With nothing typed it offers the folders rather than every bookmark, and picking one retypes the search as its name; a typed folder name brings that folder's whole contents, which are exempt from the term filter (`viaFolder`) since filtering them by the folder's own name answers nothing
- `src/sidepanel/starredPages.ts` — starred Azure DevOps pages: identity is URL + search params only, plus label disambiguation and ranked search
- `src/sidepanel/bookmarkSync.ts` — two-way sync between favorites and a bookmarks folder. The folder is the shared copy because it is the half the browser syncs between machines; local favorites are a cache of it. The panel only wins for a favorite it has just added and not yet written, so a remote add/rename/delete is adopted. A stored baseline of the folder's last known state is what separates "added here" from "deleted elsewhere"
- `src/sidepanel/workItemsDateRange.ts` — default closed-date range and validation helpers for the Work items tab
- `src/sidepanel/work-items/*` + `src/sidepanel/work-items/atoms/*` — work-items tab layout plus smaller toolbar/tab-strip/date-range/row/list atoms and helper tests. Selecting a list tab is the refresh gesture: each tab refetches its own data, so there is no separate fetch button. In the flat (ungrouped) TODO and Authored lists a parent is dropped once one of its tasks is in progress, since the started task is what needs focus and the parent row then adds nothing; grouped, the parent is the heading and stays. Authored additionally keeps only started items in the main list and collapses the rest behind a "Not started" accordion
- `src/sidepanel/work-item/*` + `src/sidepanel/work-item/atoms/*` — active-item tab layout plus smaller task/suggestion/pin atoms and helper tests
- `src/sidepanel/settings/*` — settings tab components with colocated `*.module.css` files and `index.ts` entry export. The tab is split into regions (Project, Quick, Favorites, Token, Tools) on a `SectionTabs` strip, with **Save** in the strip itself: `settingsDirty.ts` maps each field to its region so Save is enabled only on a real change and its tooltip names where the unsaved edits are
- `src/sidepanel/{chromeStorage,defaultSettings}.ts` — side panel storage/defaults helpers, including cached work-items results plus browser-local closed-date range and parent-detail toggle state
- `src/sidepanel/tabMessaging/index.ts` + `src/sidepanel/tabMessaging/*.ts` — side panel tab messaging barrel + function modules
- `src/devops/*.test.ts` + `src/sidepanel/tabMessaging/*.test.ts` / `*.test.tsx` — Vitest unit tests (globals enabled)
- `types/*.ts` — shared extension types imported via the `@/types` alias, including the `WorkItemsQuery` request/range types
- `vite.config.ts` — Vite multi-entry build config for extension output. `content-script` and `token-interceptor` are built separately as self-contained IIFEs, since a content script and a MAIN-world `document_start` script are plain scripts and cannot be ES modules. They go through Vite in lib mode, so the project carries one bundler. They are left unminified on purpose — they run inside Azure DevOps's page, where reading them in DevTools is worth more than the bytes
- `dist/` — generated unpacked extension files (build output)
- `README.md` — user/developer documentation
- `AGENTS.md` — agent instructions
- `CLAUDE.md` — Claude Code entry point (imports `AGENTS.md`)

## Configuration Rules

- Runtime settings should stay in browser storage unless explicitly changed.
- Persisted side-panel state in `src/sidepanel/chromeStorage.ts` (for example cached work items, closed-date range and parent-detail toggle preferences, hidden child-task state filters, parent suggestions, active tab, pinned active work-item context, and collapsed recent-features state) should remain browser-local and backwards-compatible when storage shapes or keys change.
- Local-only development configuration must not be committed.
- Avoid hardcoding organization, project, user names, tokens, or URLs that should remain configurable.
- Prefer deriving organization/project from the last visited `dev.azure.com/{organization}/{project}` URL when settings are empty.
- Treat an empty `assignedTo` setting as the current signed-in Azure DevOps user (`@me`) when querying work items; explicit saved values remain overrides.
- Preserve the `todoStates` array so custom Azure DevOps states stay available for the TODO section alongside the default To Do/In Progress filter.
- Keep the bookmark baseline (`bookmarkSyncBaseline`) browser-local: it records *this* machine's last view of the shared folder, so syncing it would defeat the comparison it exists for.
- Favorites sync both ways. Anything that changes favorites locally must go through `commitStarredPages` and pass the previous list, or an unstar will be read as a remote addition and adopted straight back.
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
- Azure DevOps data requests authenticate with the runtime PAT (Basic auth); the browser session is used only to mint/rotate it.
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

- add backend services (the PAT is minted at runtime in the browser, never via a proxy)
- require the user to manually create or paste a personal access token (the extension mints and rotates its own)
- add complex tooling for a small change
