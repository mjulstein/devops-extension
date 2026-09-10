[root](../../../README.md) / [src](../../README.md) / [sidepanel](../README.md) / settings

# `src/sidepanel/settings/`

This directory contains the Settings tab UI.

## Files in this directory

- `index.ts` — barrel export for the settings tab component.
- `SettingsPane.tsx` + `SettingsCard.module.css` — the Settings tab, split into regions on a `SectionTabs` strip like the work-items lists: **Project** (organization, project, assigned-to, TODO states), **Quick** (quick-task parent and archive ids), **Favorites** (bookmark folder name, sync status, favorites editor), **Token** (PAT status and actions) and **Tools** (tab icons, panel/extension reload). Settings are one stored object, so **Save settings** stays visible on every region that has fields.
- `FavoritesEditor.tsx` + `FavoritesEditor.module.css` — accordion editor for starred pages, working on a draft with explicit Save/Cancel rather than persisting as you type.
- `favoritesDraft.ts` + `favoritesDraft.test.ts` — the draft model behind that editor: rows carry their own key because the address is editable.
- `SettingsHelp.tsx` — `<details>` accordion that keeps long explanations out of the way until asked for.
