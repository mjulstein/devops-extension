[root](../../README.md) / [src](../README.md) / favoritesPalette

# `src/favoritesPalette/`

This directory contains the favorites palette: a centred dialog the content
script draws over an Azure DevOps page when the keyboard shortcut is pressed.

It exists because the side panel is the wrong surface for a keyboard action. The
panel is narrow, off to one side, and — being a separate window — does not
reliably hold focus, which is why its own menu has to retry focusing its search
box. A dialog in the page has neither problem: it is centred where the user is
already looking, and the page's document already has focus, so the search field
simply takes it.

Off Azure DevOps, and on a tab whose content script has not loaded, the shortcut
still falls back to the side panel's menu, so the feature never simply fails.

## Files in this directory

- `paletteModel.ts` + `paletteModel.test.ts` — what a keypress means and which
  rows a query produces, kept apart from the DOM so it can be tested without a
  browser. Clamps the highlight into the current result set, so one left over
  from a longer list cannot point past the end of a shorter one.
- `favoritesPalette.ts` — the dialog itself, built by hand rather than with the
  side panel's React components because it renders into a page it does not own.

Choosing a favorite navigates the current tab. Holding Ctrl (or Cmd) opens it in
a new tab instead, following the browser's own convention — the palette reports
which was asked for and the service worker does the navigating, since a content
script cannot manage tabs.

## Styling

The shadow root is for layout, not for colour: the host page's rules cannot
reach in and break the dialog, but CSS custom properties are inherited
properties and cross the shadow boundary freely. Every colour reads Azure
DevOps's own theme variables (`--background-color`, `--text-primary-color`,
`--palette-neutral-*`, `--communication-background`) with a light default as
fallback, so the palette follows the page into dark mode without knowing
anything about themes.

`all: initial` on the host would sever exactly that inheritance, so it must not
come back.
