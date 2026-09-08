[root](../../../../README.md) / [src](../../../README.md) / [sidepanel](../../README.md) / [work-items](../README.md) / atoms

# `src/sidepanel/work-items/atoms/`

This directory contains small Work items tab atoms and helpers that keep `StatusCard.tsx` and `WorkItemSection.tsx` focused on section layout.

## Files in this directory

- `ClosedDateGroup.tsx` + `ClosedDateGroup.module.css` — grouped closed-day heading plus per-day refetch action.
- `ClosedDateRangeControls.tsx` + `ClosedDateRangeControls.module.css` — closed-date range reset/start/end controls.
- `WorkItemRow.tsx` + `WorkItemRow.module.css` — single work-item row with optional parent details and state column.
- `WorkItemsToolbar.tsx` + `WorkItemsToolbar.module.css` — fetch button and parent-detail toggle row.
- `WorkItemListTabs.tsx` + `WorkItemListTabs.module.css` — TODO/Quick/Authored/PRs tab strip with per-list counts.
- `QuickTaskList.tsx` + `QuickTaskList.module.css` — quick-task rows with the title input, pin, and archive actions.
- `PullRequestList.tsx` + `PullRequestList.module.css` — pull-request activity rows for the PRs tab.
- `ParentGroupSection.tsx` + `ParentGroupSection.module.css` — parent heading with its grouped child rows.
- `quickTaskSorting.ts` + `quickTaskSorting.test.ts` — pinned-first, done-last quick-task ordering helpers.
- `staleLists.ts` + `staleLists.test.ts` — which lazily-loaded lists a refetch invalidated, so a list refreshes in place instead of blanking out.
- `workItemGrouping.ts` + `workItemGrouping.test.ts` — closed-item grouping and completed-item emphasis helpers.
