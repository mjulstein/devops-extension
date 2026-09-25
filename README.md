# Azure DevOps Daily Work Item Export (Edge Extension)

A Microsoft Edge extension that generates a quick summary of Azure DevOps work items assigned to a specific user.

The extension runs inside the browser and queries the Azure DevOps REST API with a Personal Access Token (PAT) it mints and rotates **at runtime** — you never create or paste a token. The browser's authenticated Azure DevOps session is used only to mint that PAT, so data calls keep working even when the page's short-lived Bearer token expires. See [`CONTEXT.md`](./CONTEXT.md) for the authentication vocabulary and [`specs/002-pat-auth-redesign`](./specs/002-pat-auth-redesign/spec.md) for the design.

If the session is genuinely signed out, the side panel shows **Reconnect needed** with a link that opens Azure DevOps in a new tab; once you are signed in there it recovers automatically.

Results are displayed in the side panel as clickable links grouped into:

- **TODO**: active work items assigned to the configured user
- **Closed**: work items assigned to the user that were completed within the selected closed-date range (default: today back through 7 days ago), grouped by closed date

The Work items tab keeps its closed-date range and optional “show task parent details” toggle in browser-local storage. Changing the date range automatically refreshes the closed section, and each closed-date group includes a one-day refetch action.

A dedicated **Create child tasks** section is available at the bottom of the panel.

- Open a Bug or PBI work item in Azure DevOps at least once so the extension can track it as the last visited work-item view.
- Type a task title (required).
- Press **Enter** (or click **Create task for #workItemId**).

Each new child task is created immediately and listed under the button as a clickable link so you can create many tasks quickly.

A raw JSON response is also available in a collapsible section for debugging.

## Tech Stack

- Vite build pipeline
- React + TypeScript side panel UI
- TypeScript content script and service worker
- Manifest V3 Edge extension
- ESLint 10 flat config with TypeScript + React linting
- Prettier formatting with lint warnings via `prettier/prettier`
- Vitest 4 for unit tests (`*.test.ts` / `*.test.tsx`) with globals enabled

## Documentation Map

- [`AGENTS.md`](./AGENTS.md) — agent/contributor workflow and documentation rules
- [`docs/principles.md`](./docs/principles.md) — non-negotiable project principles
- [`docs/adr`](./docs/adr/0001-replaceable-provider-adapters.md) — architecture decision records
- [`specs`](./specs/README.md) — promoted feature specs and the idea-to-spec workflow
- [`specs/ideas`](./specs/ideas/README.md) — incubator for rough feature ideas before they become numbered specs
- [`dev`](./dev/README.md) — side-panel dev harness for UI work without an extension build
- [`src`](./src/README.md) — extension entry points plus links to the source subdirectory docs
- [`src/devops`](./src/devops/README.md) — Azure DevOps-specific selectors, parsing, context, and REST logic
- [`src/sidepanel`](./src/sidepanel/README.md) — side panel shell, storage helpers, and UI module docs
- [`types`](./types/README.md) — shared type definitions used through the `@/types` alias

## Planning Workflow

Features are planned in Markdown before implementation.

- Use [`specs/ideas`](./specs/ideas/README.md) as the incubator for rough feature notes, open questions, and candidate workflows.
- Promote an idea into a numbered directory such as `specs/001-feature-name/` when scope, acceptance scenarios, and sequencing are clear enough to plan.
- Project-level principles live in [`docs/principles.md`](./docs/principles.md); architecture decisions in [`docs/adr`](./docs/adr/0001-replaceable-provider-adapters.md).
- Agent skills for this repo live in `.claude/skills/` — `repo-planning` for spec/plan work, `sidepanel-dev-harness` for UI iteration.

## Project Structure

Use the linked directory `README.md` files for structure details instead of expanding the full tree in this document.

- [`docs`](./docs/principles.md) — principles and architecture decision records
- [`specs`](./specs/README.md) — promoted specs plus the ideas incubator
- [`src`](./src/README.md) — runtime entry points and links to `src/devops/` and `src/sidepanel/`
- [`types`](./types/README.md) — shared type shapes
- `dist/` — generated unpacked extension output created by `npm run build`

`src/content-script.ts` is intentionally kept as a generic runtime message bridge. Azure DevOps-specific DOM parsing, URL/context detection, and API logic live in `src/devops/` modules.

## Naming Conventions

- React components use `PascalCase.tsx`.
- Side panel component styles live beside their components in `ComponentName.module.css` files and are imported as `import classes from './ComponentName.module.css';`.
- Side panel sections may include local `atoms/` directories for reusable interactive concepts (for example task buttons, grouped rows, and compact control strips) plus focused `*.test.ts` / `*.test.tsx` files.
- Function/utility modules use `camelCase.ts`.

## Build Output

`npm run build` generates the extension artifacts in `dist/`, including:

- `manifest.json`
- `service-worker.js`
- `content-script.js`
- `token-interceptor.js` — injected at `document_start` in the page's main world to capture the Bearer token used to mint the PAT
- `sidepanel.html`
- `sidepanel.js`
- emitted CSS assets generated from the side panel's colocated CSS module imports

Load `dist/` as the unpacked extension directory in Edge. After rebuilding, reload the extension in `edge://extensions`, then refresh any open Azure DevOps tab so the latest `token-interceptor.js` is re-injected.

## Theme

The panel follows Azure DevOps's own light/dark setting rather than keeping a
second preference. Reading and setting it needs the `vso.settings_write` scope,
which is why the runtime PAT carries it alongside the work-item and code scopes;
changing that list rotates the existing token automatically. The switch beside the duplicate-tab
button shows which theme is in force and changes Azure DevOps's setting when
clicked. It always changes the panel, even when Azure DevOps cannot be reached;
Azure DevOps wins on open, so a theme changed there is adopted next time the
panel loads. Colours are defined once in
[`src/theme.css`](./src/theme.css) as semantic tokens for both themes, and
Settings → **Theme** lists every token for both palettes so any of them can be
overridden. Overrides apply to the panel and to the favorites palette, and only
what you change is stored — anything left alone keeps following the defaults.

## Configuration

The extension stores runtime settings in browser storage.

The Work items tab also stores its closed-date range filter and parent-detail visibility toggle in browser-local storage so the tab reopens with the same view preferences. The Active item tab stores its Recent features collapsed state in browser-local storage as well.

In the side panel **Settings** card, use **Reload extension** during development to apply updates quickly. You can still reload manually from `edge://extensions` if needed.

Example structure:

```json
{
  "organization": "",
  "project": "",
  "assignedTo": "<user display name>",
  "todoStates": []
}
```

- Leave `organization` and `project` empty to auto-fill them from the last
  visited `https://dev.azure.com/{organization}/{project}` URL.
- Leave `assignedTo` empty to query work items for the current signed-in Azure
  DevOps user (`@me`).
- Use `todoStates` to persist any additional Azure DevOps states that should
  appear in the TODO section along with the default To Do/In Progress filter.
- If you set `organization` and/or `project` in Settings, those saved overrides
  are used until you change them.

## Development

1. Install dependencies:

```bash
npm install
```

2. Run linting:

```bash
npm run lint
```

3. Build extension files:

```bash
npm run build
```

4. Run tests:

```bash
npm test
```

5. Open Microsoft Edge and navigate to `edge://extensions`.
6. Enable **Developer mode**.
7. Click **Load unpacked**.
8. Select the `dist/` directory.

## Usage

1. Open any Azure DevOps page.
2. Open the extension side panel.
3. Optionally set `Assigned to`, `Organization`, and `Project` overrides. Leave
   `Assigned to` empty to use `@me`.
4. Use the new **TODO states** field to extend the TODO section beyond the
   default To Do/In Progress filter (enter each state name separated by commas).
5. Click a list tab — **TODO**, **Quick**, **Authored**, or **PRs** — to load it.
   Selecting a tab is also how you refresh it; rows you can already see stay on
   screen and pulse yellow while the refresh runs.
6. On the **Quick** tab, the button beside the input creates a task: leave the
   input empty to capture the page you are on, or type a title to use that
   instead. A **Created #id** link appears under the tabs and opens the new task
   in a new tab.
7. In **TODO** and **Authored**, a parent is hidden once one of its tasks is in
   progress — the started task is what needs focus, and the parent row adds
   nothing next to it. A parent with nothing started keeps its row, because then
   it is what carries the context. **Authored** also collapses everything not yet
   started behind a **Not started** accordion, and never lists quick tasks.
8. Adjust the closed-date range inputs to refresh closed items for a specific window, or use **Reset to default** to restore the default today-to-7-days-ago range.
9. Optionally enable **Show task parent details** to see the full hierarchy grouped instead, with each task under its parent.
10. Use the per-day refetch button beside any closed-date heading to reload only that day.
11. The pop-out button beside **Close duplicate tabs** moves the panel into a
    window of its own — useful on a second screen, since the browser's side
    panel is fixed to one edge. Only one is ever open, and it remembers its
    size and position.
12. Star an Azure DevOps page with the toggle beside the favorites menu. The
    menu opens at the full width of the side panel, and each entry shows the
    page's icon taken from the browser's own favicon cache — the same icon the
    bookmarks menu draws, so favorites synced in from another machine are
    recognisable too.
    A favorite opens in the current tab; hold **Ctrl** to open it in a new one.
    Quick tasks that are in progress are listed under the favorites behind a
    divider, and mirrored into a **Quick tasks** sub-folder of the bookmarks
    folder — so they reach a machine with no extension installed, and their
    bookmarks disappear as the tasks are finished. Start the search with `.` to
    reach the browser's own bookmarks: on its own it lists your bookmark folders,
    and picking one — or typing its name — shows what is inside it. Rows carry
    each site's icon. The **Bookmarks** button opens the extension's own
    bookmark manager page (see below).
    **Ctrl+Period** opens the favorites palette in a small window of its own,
    centred on the browser window and with its search already focused. It works
    on any page, not only Azure DevOps, because a window does not depend on a
    content script and takes focus by being a window. It closes itself when
    another browser window takes focus, or after fifteen seconds untouched —
    **📌 Pin** in its header stops both, and as with the other windows only one
    is ever open. Switching to another application does not close it, which
    would otherwise make it unusable the moment you copied something from
    somewhere else. Escape, the backdrop and opening a favorite all close it as
    before. The in-page overlay it replaced is still in the code behind
    `FAVORITES_SEARCH_SURFACE` in the service worker, while the window is being
    lived with; Settings →
    **Tools** shows which keys the browser actually bound to it, and browsers
    silently leave the suggested combination unbound when it clashes with one of
    their own — assign your own at `edge://extensions/shortcuts` if it is blank. Name a
    bookmarks folder on Settings → **Favorites** and the list is kept in step
    with that folder in both directions, so favorites also appear in
    address-bar autocomplete and travel between machines over the browser's own
    bookmark sync. A favorite added, renamed or deleted on another machine is
    adopted here once the browser syncs it; the panel only overrides the folder
    for a favorite you just added.
13. Open the **Active item** tab to create child tasks. The tab resolves context from the last visited Azure DevOps work-item view (or the pinned item if set), so it can continue working even when a non-DevOps tab is active.

The extension queries Azure DevOps with its runtime-minted PAT (over HTTP Basic auth) and displays matching work items in the side panel.

## Bookmark manager

The **Bookmarks** button in the favorites palette opens the extension's own
bookmark manager instead of the browser's. It opens in a window of its own — a
popup, so there is no tab strip, bookmarks bar or navigation toolbar in the way
— and there is never more than one: pressing the button again raises the window
already open rather than starting a second view of the same tree. The window
remembers where you left it and how big it was, which is the point on a wide
screen. The browser's manager cannot tell you
what is saved twice or what is now empty, which is most of the reason it gets
opened in the first place.

The page is three columns with a drag handle between each. The folder tree and
the issue lists are sized by hand and remembered per browser; the contents in
the middle take whatever is left, so widening the window feeds the list of
bookmarks rather than the chrome around it. The handles work from the keyboard
too — focus one and use the arrow keys. Below 1000px the columns stack and the
handles go away. The defaults are the sizes the page has always had, so nothing
moves until you drag something.

The left of the page is for
reorganising: the folder tree, the selected folder's contents beside it, and
dragging a bookmark or a folder onto a folder files it there. A folder cannot be
dropped into itself or into one of its own descendants. Each folder row carries
the same pencil and trash can as a bookmark — rename in place, or delete, with a
confirmation first when the folder is not empty, since deleting takes everything
inside it. The **⇤** button flattens a folder: everything inside it moves up one level and
the folder itself goes, so `path/to/flatten/that/has/nest` flattened at
`flatten` becomes `path/to/that/has/nest`. Whatever nesting the contents carry
comes along untouched. The **−** button collapses a folder's subfolders, **+**
brings them back. The search box at the top
spans every folder, which is what you want when you cannot remember where
something was filed.

The right column holds four lists, one tab at a time and each with its own filter:

- **Duplicate name** — bookmarks sharing a title, wherever they live.
- **Duplicate path** — the same address, ignoring search parameters and the
  hash, filed in two different folders. Two copies inside one folder are left
  out: they are already side by side in the organiser above.
- **Duplicate folder** — folders sharing a name, which is how a bookmark ends up
  in the wrong one. These rows rename and move but do not delete: a duplicated
  folder may be full, and the fix is almost always the name.
- **Empty folders** — folders holding nothing at all.

Selecting a folder in the tree narrows all four lists to that subtree, so a
duplicate you just created is visible where you are working instead of buried in
a whole-tree list. **All** above the tree clears the selection.

Clicking a row in one of these lists shows that bookmark's folder in the tree
rather than following the link, opening whatever was collapsed above it — the
question a duplicate raises is where it lives. Hold **Ctrl** to open the bookmark
instead. The lists themselves stay as they were: narrowing them to the folder you
just jumped to would drop the very copy you were comparing it with.

Every row in both halves carries the same actions: a pencil to edit the title and
address in place, a trash can to delete it, and a **Move to…** list to send it to
another folder without leaving the list you found it in. The checkbox on the left
of a row adds it to a selection that spans both halves of the page; while
anything is selected a bar appears at the top to move all of it into one folder
or delete it in one go. The page follows
whatever change happens elsewhere — another window, the browser's own manager, or
a sync from another machine — so it never shows a tree that no longer exists.

## License

MIT License
