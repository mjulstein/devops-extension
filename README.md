# Azure DevOps Daily Work Item Export (Edge Extension)

A Microsoft Edge extension that generates a quick summary of Azure DevOps work items assigned to a specific user.

The extension runs inside the browser and uses the currently authenticated Azure DevOps session to query work items through the Azure DevOps REST API. No personal access tokens or additional authentication are required.

Results are displayed in the side panel as clickable links grouped into:

- **TODO**: active work items assigned to the configured user
- **Closed last week**: work items assigned to the user that were completed within the last 7 days

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
- [`.specify`](./.specify/README.md) — local Spec Kit memory and planning templates
- [`specs`](./specs/README.md) — promoted feature specs and the idea-to-spec workflow
- [`specs/ideas`](./specs/ideas/README.md) — incubator for rough feature ideas before they become numbered specs
- [`src`](./src/README.md) — extension entry points plus links to the source subdirectory docs
- [`src/devops`](./src/devops/README.md) — Azure DevOps-specific selectors, parsing, context, and REST logic
- [`src/sidepanel`](./src/sidepanel/README.md) — side panel shell, storage helpers, and UI module docs
- [`types`](./types/README.md) — shared type definitions used through the `@/types` alias

## Spec Kit Workspace

This repository now includes a lightweight Spec Kit scaffold for planning future work before implementation.

- Use [`specs/ideas`](./specs/ideas/README.md) as the incubator for rough feature notes, open questions, and candidate workflows.
- Promote an idea into a numbered directory such as `specs/001-feature-name/` when scope, acceptance scenarios, and sequencing are clear enough to plan.
- Use the templates under [`.specify/templates`](./.specify/templates/README.md) for new ideas, promoted specs, implementation plans, and task breakdowns.
- Project-level planning constraints live in [`.specify/memory/constitution.md`](./.specify/memory/constitution.md).

## Project Structure

Use the linked directory `README.md` files for structure details instead of expanding the full tree in this document.

- [`.specify`](./.specify/README.md) — Spec Kit project memory and markdown templates
- [`specs`](./specs/README.md) — promoted specs plus the ideas incubator
- [`src`](./src/README.md) — runtime entry points and links to `src/devops/` and `src/sidepanel/`
- [`types`](./types/README.md) — shared type shapes
- `dist/` — generated unpacked extension output created by `npm run build`

`src/content-script.ts` is intentionally kept as a generic runtime message bridge. Azure DevOps-specific DOM parsing, URL/context detection, and API logic live in `src/devops/` modules.

## Naming Conventions

- React components use `PascalCase.tsx`.
- Function/utility modules use `camelCase.ts`.

## Build Output

`npm run build` generates the extension artifacts in `dist/`, including:

- `manifest.json`
- `service-worker.js`
- `content-script.js`
- `sidepanel.html`
- `sidepanel.js`
- `sidepanel.css`

Load `dist/` as the unpacked extension directory in Edge.

## Configuration

The extension stores runtime settings in browser storage.

In the side panel **Settings** card, use **Reload extension** during development to apply updates quickly. You can still reload manually from `edge://extensions` if needed.

Example structure:

```json
{
  "organization": "",
  "project": "",
  "assignedTo": "<user display name>"
}
```

- Leave `organization` and `project` empty to auto-fill them from the last
  visited `https://dev.azure.com/{organization}/{project}` URL.
- Leave `assignedTo` empty to query work items for the current signed-in Azure
  DevOps user (`@me`).
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
4. Click **Fetch work items**.
5. Open the **Active item** tab to create child tasks. The tab resolves context from the last visited Azure DevOps work-item view (or the pinned item if set), so it can continue working even when a non-DevOps tab is active.

The extension queries Azure DevOps using the current browser session and displays matching work items in the side panel.

## License

MIT License
