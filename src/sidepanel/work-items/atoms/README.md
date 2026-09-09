[root](../../../../README.md) / [src](../../../README.md) / [sidepanel](../../README.md) / [work-items](../README.md) / atoms

# `src/sidepanel/work-items/atoms/`

This directory contains small Work items tab atoms and helpers that keep `StatusCard.tsx` and `WorkItemSection.tsx` focused on section layout.

## Files in this directory

- `ClosedDateGroup.tsx` + `ClosedDateGroup.module.css` — grouped closed-day heading plus per-day refetch action.
- `ClosedDateRangeControls.tsx` + `ClosedDateRangeControls.module.css` — closed-date range reset/start/end controls.
- `WorkItemRow.tsx` + `WorkItemRow.module.css` — single work-item row with optional parent details and state column.
- `WorkItemsToolbar.tsx` + `WorkItemsToolbar.module.css` — parent-detail toggle row.
- `WorkItemListTabs.tsx` + `WorkItemListTabs.module.css` — TODO/Quick/Authored/PRs tab strip with per-list counts.
- `QuickTaskList.tsx` + `QuickTaskList.module.css` — quick-task rows plus the title input and its create button, which captures the current page when the input is empty and uses the typed title otherwise.
- `PullRequestList.tsx` + `PullRequestList.module.css` + `PullRequestList.test.tsx` — pull-request activity rows for the PRs tab, scrolling inside their own box and capped at 20 rows until expanded.
- `ParentGroupSection.tsx` + `ParentGroupSection.module.css` — parent heading with its grouped child rows.
- `quickTaskSorting.ts` + `quickTaskSorting.test.ts` — pinned-first, done-last quick-task ordering helpers.
- `staleLists.ts` + `staleLists.test.ts` — which lazily-loaded lists a refetch invalidated, so a list refreshes in place instead of blanking out.
- `workItemGrouping.ts` + `workItemGrouping.test.ts` — closed-item grouping and completed-item emphasis helpers.
