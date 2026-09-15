[root](../../../README.md) / [src](../../README.md) / [sidepanel](../README.md) / settings

# `src/sidepanel/settings/`

This directory contains the Settings tab UI.

## Files in this directory

- `index.ts` — barrel export for the settings tab component.
- `SettingsPane.tsx` + `SettingsCard.module.css` — the Settings tab, split into regions on a `SectionTabs` strip like the work-items lists: **Project** (organization, project, assigned-to, TODO states), **Quick** (quick-task parent and archive ids), **Favorites** (bookmark folder name, sync status, favorites editor), **Theme** (colour tokens for both themes), **Token** (PAT status and actions) and **Tools** (tab icons, panel/extension reload). Settings are one stored object, so **Save** lives in the tab strip rather than on a tab: it is enabled only when a field differs from what is stored, and its tooltip names which regions hold the unsaved changes.
- `FavoritesEditor.tsx` + `FavoritesEditor.module.css` — accordion editor for starred pages, working on a draft with explicit Save/Cancel rather than persisting as you type.
- `favoritesDraft.ts` + `favoritesDraft.test.ts` — the draft model behind that editor: rows carry their own key because the address is editable.
- `settingsDirty.ts` + `settingsDirty.test.ts` — which region owns which settings field, so Save can be gated on a real change and say where the pending edits are.
- `ThemeEditor.tsx` + `ThemeEditor.module.css` — the **Theme** region: both palettes, token by token. Defaults are read from `src/theme.css` rather than restated here, so there is no second copy to drift, and only tokens the user actually changed are stored — a value equal to its default is dropped so a later change to that default is still inherited. Edits repaint as they are typed, because a palette is judged by looking at it.
- `ShortcutStatus.tsx` — shows on **Tools** what keys the browser actually bound to the favorites shortcut, what happened the last time it was pressed, and what the panel can see of the active tab. A bound shortcut that still does nothing can fail in three places — the keypress never reaching the extension, the browser refusing to open the panel, the panel never taking the focus message — and the only other place that tells them apart is the service worker console.
- `SettingsHelp.tsx` — `<details>` accordion that keeps long explanations out of the way until asked for.
