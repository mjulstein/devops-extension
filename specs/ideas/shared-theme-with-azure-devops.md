[root](../../README.md) / [specs](../README.md) / [ideas](./README.md) / shared-theme-with-azure-devops.md

# Idea: Share Azure DevOps's Light/Dark Theme

**Status**: Incubating
**Created**: 2026-09-15
**Source**: Conversation note — a switch in the side panel's top-right corner should toggle Azure DevOps's own dark/light setting, and the panel should follow it

## Summary

The side panel is permanently light while Azure DevOps may be dark, so the two
sit side by side disagreeing. This idea gives the panel a theme that follows
Azure DevOps's, plus a switch in the panel that flips Azure DevOps's setting
rather than keeping a second one of its own.

The favorites palette already does the following half: it renders inside the page
and reads that page's CSS custom properties, so it is dark whenever Azure DevOps
is. The panel is a separate document and inherits nothing, so it needs the theme
carried across explicitly.

## Why It Might Matter

- Two panes of the same workflow, one dark and one light, is the kind of mismatch
  that is noticed every time.
- One setting rather than two: the panel should not accumulate its own theme
  preference that can drift out of step with the product it reports on.
- The switch is also a quicker route to Azure DevOps's own toggle, which is
  several clicks deep in its user menu.

## Open Questions

- **How the theme is read.** Azure DevOps exposes a theme through CSS custom
  properties on the page, so a content script can report the computed values or
  the theme's name. Which is the stable contract — the theme id, or a set of
  variables? Reading variables means the panel's CSS has to be expressed in the
  same vocabulary.
- **How the theme is written.** Toggling Azure DevOps's setting from outside its
  UI needs either an API call or driving its own controls, and the second is
  exactly the brittle DOM coupling `AGENTS.md` keeps behind `src/devops/`. Find
  out whether there is a supported settings endpoint before committing.
- **What the panel does when no Azure DevOps tab is open**, since the theme's
  source is then absent. Remember the last seen theme, or fall back to the
  browser's `prefers-color-scheme`?
- **Where the panel's colours live.** They are currently literal hex values
  spread across CSS modules; a theme needs them behind tokens first. That is the
  bulk of the work and is worth doing whether or not the toggle ships.
- **Does the switch belong beside the favorites menu's dismiss control** in the
  panel header, or in Settings? The header is quicker; Settings is where every
  other preference lives.

## Promotion Criteria

Ready to promote when it is known whether Azure DevOps's theme can be *set*
through a supported call rather than by driving its UI, and when the panel's
colours have been pulled behind tokens.

## Related

- `src/favoritesPalette/README.md` — how the palette already inherits the page's
  theme variables through its shadow boundary.
- [`centered-favorites-palette.md`](./centered-favorites-palette.md) — the idea
  that produced the palette.
