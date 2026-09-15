[root](../../README.md) / [specs](../README.md) / [ideas](./README.md) / centered-favorites-palette.md

# Idea: Favorites As A Centered Command Palette

**Status**: Implemented — see `src/favoritesPalette/`; the open questions below that remain open are tracked in the theme idea
**Created**: 2026-09-15
**Source**: Conversation note — the favorites menu should open as a dialog in the centre of the screen rather than as a dropdown inside the side panel

## Summary

Today the favorites shortcut opens the panel and drops a menu inside it. The menu
is bounded by the side panel, which is narrow, off to one side, and only visible
when the panel is open. This idea replaces that with a centred dialog carrying its
own search field, focused on open — the shape people already know from editor
command palettes.

## Why It Might Matter

- The eye is already in the middle of the screen; the panel edge is not where a
  keyboard-driven action wants to put its input.
- A dialog can be wider than the panel, so long Azure DevOps URLs stop being
  truncated.
- It decouples "search my favorites" from "the side panel is open", which is the
  only reason the command opens the panel at all today.
- The panel's focus problems came from the side panel being a separate window
  that does not reliably hold focus. A different surface may not have them —
  or may have its own.

## Feasibility

An extension cannot draw over the browser's own chrome, so "centre of the screen"
has to be one of these, and they are not equivalent:

1. **Injected overlay in the page** (content script + `chrome.scripting`). Truly
   centred over the page, and the closest thing to a command palette. Only works
   on pages the extension may inject into: it cannot appear over `edge://` pages,
   the new tab page, the Web Store, a PDF viewer, or any site outside
   `host_permissions`. The overlay also lives in the page's DOM, so it needs a
   shadow root to survive the host page's CSS.
2. **A popup window** (`chrome.windows.create` with `type: 'popup'`, positioned
   from `screen` metrics). Works everywhere regardless of the active page, is a
   real focusable window, and can reuse the existing React components. It is a
   separate OS window, so it appears in the taskbar and has a frame, which is a
   heavier object than an overlay.
3. **Keep it in the side panel** as it is today.

### Leading design: overlay on Azure DevOps, side panel everywhere else

Option 1 is cheap specifically where it matters. `dev.azure.com` is already in
`host_permissions` and already runs a content script at `document_idle`, so an
overlay there needs no new permission and no new injection plumbing. On any other
page the shortcut keeps doing exactly what it does today, which means there is
one new surface rather than a replacement, and no page where the feature simply
fails.

This also sidesteps the problem that produced the focus-retry loop in the side
panel. An overlay lives in the page's own document, and that document already has
focus, because the page is what the user is looking at — so `autofocus` on its
search field is enough. The side panel is a separate window that does not reliably
hold focus, which is why the panel's menu needs retries at all.

Option 2 stays the answer only if the palette must also appear over browser pages,
which is a bigger ask than what this idea is for.

## User-Facing Flow

1. Press the shortcut on an Azure DevOps page.
2. A dialog appears centred over the page, with an empty search field already
   focused. The side panel is not opened and not needed.
3. Typing filters favorites with the existing ranking; Up/Down move, Enter opens
   the page in a reused tab, Escape dismisses.
4. Dismissing returns focus to the page.

On any other page the shortcut behaves as it does today: the side panel opens
with its own menu focused.

## Open Questions

- The side panel keeps its own dropdown either way, so the same list has two
  renderings. Share the ranking and row markup, or accept a second, simpler
  renderer in the overlay and keep them independent?
- The overlay needs the favorites list. Read `chrome.storage.local` from the
  content script, or have the service worker hand the list over with the open
  message? The second keeps storage shapes out of the page context.
- Style isolation: a shadow root keeps the host page's CSS out, but the panel's
  CSS modules do not cross into it for free.
- Key handling has to stop at the overlay — Azure DevOps binds plenty of single
  keys, and Enter or Escape reaching the page underneath would be worse than no
  palette.
- What does the shortcut do when the active tab is Azure DevOps but the content
  script has not loaded yet (a fresh tab, a page mid-navigation)? Falling back to
  the side panel is probably right, but it must not hang waiting.
- Should the palette do more than favorites once it exists (work items, quick
  task capture)? If yes, the search field is a router, not a filter, and that
  changes its design.

## Promotion Criteria

Ready to promote when it is decided how the overlay gets the favorites list, how
much rendering it shares with the side-panel menu, and what the shortcut does on
an Azure DevOps tab whose content script is not ready yet.

## Related

- `src/sidepanel/atoms/StarredPagesMenu.tsx` — the current menu, its ranking, and
  the focus-retry and idle-close behaviour that exist because a side panel loses
  focus without telling its own document.
- `src/content-script.ts` — the generic message bridge already loaded on
  `dev.azure.com`; per `AGENTS.md` it stays generic, so anything Azure
  DevOps-specific about the overlay belongs under `src/devops/`.
- `src/sidepanel/shortcutDiagnostics.ts` — what the keyboard command actually
  bound and what happened on the last press.
