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

Off Azure DevOps the shortcut falls back to the side panel's menu, so the feature
never simply fails. On an Azure DevOps tab whose content script predates the last
extension reload, one is injected and the message retried — that is the
difference between the palette working sometimes and working always.

The panel's own favorites trigger routes through the same service-worker entry
point, so the button and the shortcut always land on the same surface.

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

## Icons

Rows carry the site's icon. The side panel can point an `<img>` at the browser's
favicon cache directly, but the palette renders inside Azure DevOps's page, where
an extension resource is not loadable — so the service worker reads the icons and
passes them in as data URIs, keyed by origin and cached for its lifetime.

## Pointer and keyboard are two selections

Hover is a CSS effect and nothing more. An earlier version moved the keyboard
highlight on `mouseenter`, which broke both halves at once: the re-render it
triggered replaced the very button the pointer had pressed, so the mouseup
landed on a node that no longer existed and no click was ever synthesized — a
row could only be opened with Enter. It also meant Enter opened whatever the
mouse happened to be resting over rather than what the arrow keys had chosen.
`temp/cdp-click-palette-row.py` drives a real pointer press against the built
page and guards both; a synthetic `element.click()` passes either way, which is
why it does not use one.

## Keyboard

Key events are stopped at the host element. Azure DevOps binds single letters as
page shortcuts and skips them when the keystroke came from an input — but an
event crossing a shadow boundary is retargeted to the host, which is not an input
as far as the page can tell, so the page acted on letters meant for the search
box. Only the letters Azure DevOps does not bind could be typed, and their
capitals worked because its shortcuts match lowercase.

## Styling

Colour resolves in three steps: the side panel's own tokens first, passed in with
the open message so the dialog matches the panel including anything overridden in
Settings; then Azure DevOps's page variables, so it is still themed with the page
when no tokens were passed; then a light literal.

The shadow root is for layout, not for colour: the host page's rules cannot
reach in and break the dialog, but CSS custom properties are inherited
properties and cross the shadow boundary freely. Every colour reads Azure
DevOps's own theme variables (`--background-color`, `--text-primary-color`,
`--palette-neutral-*`, `--communication-background`) with a light default as
fallback, so the palette follows the page into dark mode without knowing
anything about themes.

`all: initial` on the host would sever exactly that inheritance, so it must not
come back.
