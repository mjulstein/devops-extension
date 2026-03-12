# Azure DevOps Daily Work Item Export (Edge Extension)

A Microsoft Edge extension that generates a quick summary of Azure DevOps work items assigned to a specific user.

The extension runs inside the browser and uses the currently authenticated Azure DevOps session to query work items through the Azure DevOps REST API. No personal access tokens or additional authentication are required.

Results are displayed in the side panel as clickable links grouped into:

- **TODO**: active work items assigned to the configured user
- **Closed last week**: work items assigned to the user that were completed within the last 7 days

A dedicated **Create child tasks** section is available at the bottom of the panel.

- Open a Bug or PBI work item in the active tab.
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

## Project Structure

```text
devops-extension/
├─ src/
│  ├─ devops/
│  │  ├─ activeWorkItemDom.ts
│  │  ├─ workItems.ts
│  │  └─ ...
│  ├─ sidepanel/
│  │  ├─ App.tsx
│  │  ├─ work-items/
│  │  │  ├─ index.ts
│  │  │  ├─ StatusCard.tsx
│  │  │  └─ WorkItemSection.tsx
│  │  ├─ work-item/
│  │  │  ├─ index.ts
│  │  │  └─ WorkItemCard.tsx
│  │  ├─ settings/
│  │  │  ├─ index.ts
│  │  │  └─ SettingsCard.tsx
│  │  ├─ tabMessaging/
│  │  │  ├─ index.ts
│  │  │  ├─ getActiveTabId.ts
│  │  │  ├─ getActiveTabId.test.ts
│  │  │  └─ ...
│  │  └─ ...
│  ├─ content-script.ts
│  ├─ service-worker.ts
│  └─ manifest.json
├─ types/
│  ├─ index.ts
│  ├─ Settings.ts
│  ├─ WorkItem.ts
│  └─ ...
├─ dist/
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

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
  "assignedTo": "<user display name>"
}
```

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
3. Configure only `Assigned to` (organization/project are read from the active Azure DevOps URL).
4. Click **Fetch work items**.
5. Open the **Active item** tab to create child tasks, then open a Bug or PBI work item in the active tab, type a title in **Task title**, and press **Enter** repeatedly to build a list of created tasks.

The extension queries Azure DevOps using the current browser session and displays matching work items in the side panel.

## License

MIT License
