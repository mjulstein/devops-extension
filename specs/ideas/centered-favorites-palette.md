[root](../../README.md) / [specs](../README.md) / [ideas](./README.md) / centered-favorites-palette.md

# Idea: Favorites As A Centered Command Palette

**Status**: Incubating
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

Option 2 is the one that always works; option 1 is the one that looks right.
A hybrid — inject where allowed, fall back to a popup window — is possible but
doubles the surface to maintain and to test.

## User-Facing Flow

1. Press the shortcut anywhere in the browser.
2. A dialog appears centred, with an empty search field already focused, whether
   or not the side panel is open.
3. Typing filters favorites with the existing ranking; Up/Down move, Enter opens
   the page in a reused tab, Escape dismisses.
4. Dismissing returns focus to where it was.

## Open Questions

- Which surface: injected overlay, popup window, or both with a fallback?
- What happens on a page that cannot be injected into — silently fall back to the
  side panel menu, or say why?
- Does the side panel keep its own dropdown as well, or does the trigger open the
  same dialog? Two code paths for one list is the cost of keeping both.
- Should the palette do more than favorites once it exists (work items, quick
  task capture)? If yes, the search field is a router, not a filter, and that
  changes its design.
- Where does focus return to after dismissing, given the dialog may have taken
  focus from a page, the panel, or another window?

## Promotion Criteria

Ready to promote when the surface is chosen, the non-injectable-page behaviour is
decided, and it is clear whether the side-panel menu stays or is replaced.

## Related

- `src/sidepanel/atoms/StarredPagesMenu.tsx` — the current menu, its ranking, and
  the focus-retry and idle-close behaviour that exist because a side panel loses
  focus without telling its own document.
- `src/sidepanel/shortcutDiagnostics.ts` — what the keyboard command actually
  bound and what happened on the last press.
