[root](../../../../README.md) / [src](../../../README.md) / [sidepanel](../../README.md) / [work-item](../README.md) / atoms

# `src/sidepanel/work-item/atoms/`

This directory contains small interactive Active item tab atoms that keep `WorkItemPane.tsx` focused on layout composition.

## Files in this directory

- `ParentSuggestionRow.tsx` + `ParentSuggestionRow.module.css` — reusable suggestion row with link, action button, and pin toggle.
- `PinToggleButton.tsx` + `PinToggleButton.module.css` — compact pin icon button used for feature and parent suggestion rows.
- `TaskButton.tsx` + `TaskButton.module.css` + `TaskButton.test.tsx` — child-task selection button with state-aware visual styling.
- `TaskList.tsx` + `TaskList.module.css` — child-task button list and empty state.
- `TaskStateFilters.tsx` + `TaskStateFilters.module.css` — task-state filter checkbox row.
- `TaskTitleForm.tsx` + `TaskTitleForm.module.css` — task creation input and parent hint.
- `taskStateDisplay.ts` — task-state abbreviation and tone helpers shared by task atoms.
