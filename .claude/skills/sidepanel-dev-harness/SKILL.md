---
name: sidepanel-dev-harness
description: Set up or use the side-panel dev harness and the CDP inspection tiers for this browser extension. Use when iterating on side-panel UI/UX, when asked to "see"/"screenshot"/"drive" the panel, when the build-reload-click loop is the bottleneck, or when standing up the same harness in another extension repo.
---

# Side-panel dev harness & CDP tiers

Three ways to run this extension's UI. Pick by whether you need **real data** or
**fast iteration** — they trade off against each other.

| Tier | What | Real data | Agent can drive it |
| --- | --- | --- | --- |
| 1 | Dev harness (`dev/`), fake `chrome`, Vite HMR | No — fixtures | Yes, fully |
| 2 | `chrome-extension://<id>/sidepanel.html` in a tab | Yes | Yes, fully |
| 3 | Actual docked side panel | Yes | Only after a human opens it |

**Default to tier 1** for layout, empty/error/loading states, and density work.
Escalate to tier 2/3 only to verify against real Azure DevOps data.

## Tier 1 — dev harness

```bash
npm run dev:panel        # http://127.0.0.1:5173/dev/  (vite may pick 5174 if busy)
```

Then open it in a CDP-controlled browser and iterate. See [`dev/README.md`](../../../dev/README.md).

Key property: `App` takes no props and reaches the world only via
`chrome.storage.local` + `chrome.runtime.sendMessage`, so faking the `chrome`
global drives the entire UI with **no production code changes**.

Toolbar gives scenario switching (happy/empty/many/reconnect-needed/error/slow),
panel-width presets, and storage reset. Add scenarios in `dev/scenarios.ts`; add
message routes in `dev/mockChrome.ts`.

**The harness never calls Azure DevOps.** Settings org/project are ignored. If
someone reports "it's not loading my data", that is the harness working as
designed — they need tier 2 or 3.

## Tiers 2 & 3 — the real extension

```bash
npm run build

# Dedicated profile OUTSIDE the repo — it will hold real session cookies.
google-chrome \
  --remote-debugging-port=9223 \
  --user-data-dir="$HOME/.cache/devops-extension-debug-profile" \
  --no-first-run --no-default-browser-check \
  https://dev.azure.com/ &
```

Add `--no-sandbox` if running as root, or Chrome refuses to start.

An unpacked extension's id is derived from its absolute path — `sha256(path)`, first
32 hex chars, each mapped `0-f` → `a-p` — so it stays stable across reloads:

```bash
python3 -c "import hashlib,sys;h=hashlib.sha256(sys.argv[1].encode()).hexdigest()[:32];print(''.join(chr(97+int(c,16)) for c in h))" "$PWD/dist"
```

**`--load-extension` no longer works** — Chrome removed it for consumer builds
(and the `--disable-features=DisableLoadExtensionCommandLineSwitch` workaround is
gone too). It fails silently: no error, no extension. So the human must, once per
profile:

1. `chrome://extensions` → Developer mode → **Load unpacked** → `dist/`
2. Sign in at `https://dev.azure.com/` (needed so a PAT can be minted)
3. Click the toolbar icon to open the panel (tier 3 only — a side panel cannot be
   opened programmatically; it needs a user gesture and CDP cannot click browser chrome)

Chrome also needs `--no-sandbox` when running as root, which the script passes.

After each `npm run build`, the extension card must be reloaded in
`chrome://extensions` for tiers 2/3 to pick up changes — which is exactly the loop
tier 1 exists to avoid.

## Inspecting and driving

Any Chrome DevTools Protocol client works. The transport is plain HTTP + WebSocket
on the debug port, so no specific tooling is required.

Discover targets (the side panel is a `page` whose URL starts `chrome-extension://`):

```bash
curl -s http://localhost:9223/json/list
```

Open the harness in a debug browser:

```bash
curl -s -X PUT "http://localhost:9223/json/new?http://127.0.0.1:5173/dev/"
```

To screenshot or click, attach to the target's `webSocketDebuggerUrl` and use
`Page.captureScreenshot`, `Runtime.evaluate`, and `Emulation.setDeviceMetricsOverride`
(to pin the viewport to panel width). Reach for whatever is at hand:

- `npx playwright` / `puppeteer-core` — `connectOverCDP(...)`, easiest in this repo
  since Node is already present
- `chrome-remote-interface` — thin CDP wrapper
- a short Python/Node script speaking WebSocket directly
- any personal screenshot/driver scripts you already have on `$PATH`

**Measure before opining on layout** — screenshots hide truncation. Two evaluations
pay for themselves:

- per-cell `clientWidth` vs `scrollWidth` → which text is actually clipped
- per-column `getBoundingClientRect().width` → where the row's width budget goes

Write throwaway captures to `temp/*.temp.png` and any one-off driver scripts to
`temp/` (both gitignored).

## Constraints

- Fixtures use **placeholder** org/project only (`myorg`, `myproj`) — the repo is
  public; see [`CLAUDE.md`](../../../CLAUDE.md).
- The tier-2/3 browser profile lives **outside** the repo
  (`~/.cache/devops-extension-debug-profile`) because it holds real session
  cookies. Never place it under the repo, gitignored or not.
- Screenshots go to `temp/*.temp.png` (gitignored). Real work-item data must never
  be committed.

## Standing this up in another extension repo

1. Enumerate the `chrome.*` surface the UI touches: `git grep -oh 'chrome\.[a-zA-Z.]*' -- src | sort | uniq -c | sort -rn`
2. Confirm the UI has a single seam to the backend (here: `sendMessage` wrappers in
   `src/sidepanel/tabMessaging/`). If it does, mock the `chrome` global; if not,
   introduce the seam first.
3. Copy `dev/`, adapt `scenarios.ts` fixtures and the `route()` cases, add a
   `dev:panel` script, and add `dev` to `tsconfig.json` `include`.
