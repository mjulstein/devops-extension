[root](../README.md) / [dev](./README.md)

# dev

Side-panel **dev harness**: runs the real side-panel `App` in an ordinary browser
tab under Vite, with a fake `chrome` global, so UI work needs no extension build
and no extension reload.

```bash
npm run dev:panel      # then open http://127.0.0.1:5173/dev/
```

## Why this works

`App` takes no props — every piece of state comes from `useSidepanelController`,
which reaches the outside world only through `chrome.storage.local` and
`chrome.runtime.sendMessage`. Faking that one global is therefore enough to drive
the whole UI, and **no production code changes are needed** to support the harness.

## Mock data only

The harness never contacts Azure DevOps. Every runtime message is answered from
fixtures, so the organization/project in Settings is ignored and no PAT is minted.
The toolbar shows a **MOCK DATA** badge as a reminder. Use it for layout, states,
and interaction work; verify against real data by loading `dist/` as an unpacked
extension.

## Files

- `index.html` — harness entry document.
- `main.tsx` — installs the fake `chrome` global, seeds placeholder settings, then
  mounts `App` inside a resizable side-panel-width frame.
- `mockChrome.ts` — the fake `chrome` API: `storage.local` backed by
  `localStorage` (so state survives reloads) and a `runtime.sendMessage` router.
- `scenarios.ts` — fixture scenarios (happy path, empty, many items,
  reconnect-needed, error, slow) plus the work-item/child-task fixtures.
- `DevToolbar.tsx` + `DevToolbar.module.css` — scenario switcher, panel-width
  presets, and storage reset.

## Adding a scenario

Add an entry to `SCENARIOS` in `scenarios.ts`; the toolbar picks it up
automatically. Use **placeholder** organization/project values only — never real
ones (see [`CLAUDE.md`](../CLAUDE.md)).

## Adding a message route

When the side panel starts sending a new runtime message, add a case to `route()`
in `mockChrome.ts`. Unrouted messages resolve as
`{ ok: false, error: … }` and log a warning, so a missing route is visible rather
than silent.

## Fake bookmarks

`mockChrome.ts` provides an in-memory `chrome.bookmarks` with dispatchable
events, because without it the two-way favorites sync is unreachable: an absent
`chrome.bookmarks` reads as "permission denied". Root folder ids are deliberately
not Chrome's `0`/`1`/`2` — hardcoding that numbering is what broke the real
mirror in Edge.

`globalThis.devBookmarks` acts as another machine, so a synced change can be
simulated from the console or a CDP session:

```js
await devBookmarks.syncIn('dev-favorites', 'Sprint board', 'https://dev.azure.com/myorg/myproj/_boards/board/t/Team/Stories');
devBookmarks.list('dev-favorites');
await devBookmarks.renameRemotely('102', 'Renamed elsewhere');
await devBookmarks.removeRemotely('102');
```

The panel should adopt an addition or rename and drop a deletion. Note the fake
bookmarks live in memory only, so a page reload empties the folder; the
"changed while the panel was closed" case cannot be reproduced here.

## Favorite icons

`chrome.runtime.getURL` resolves in the harness, but there is no favicon cache
behind `/_favicon/`, so favorite rows keep the icon column blank here. Icons can
only be seen in the loaded extension.
