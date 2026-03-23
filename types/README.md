[root](../README.md) / types

# `types/`

This directory contains shared TypeScript types imported through the `@/types` alias.

## Files in this directory

- `index.ts` — barrel export for the shared types.
- `ActiveWorkItemContext.ts` — types for the resolved active work-item context, including current item, detected parent, and viewed task.
- `ChildTaskItem.ts` — child-task summary shape used by the Active item tab.
- `CreatedChildTask.ts` — return type for child-task creation results.
- `ParentSuggestion.ts` — recent and pinned parent-suggestion types used by side-panel storage and UI.
- `Settings.ts` — persisted extension settings shape, including the TODO state overrides used for the Work items TODO filter.
- `WorkItem.ts` — normalized work-item shape used by fetched results, including optional parent summaries for task rows.
- `WorkItemResult.ts` — grouped open/closed work-item fetch result shape plus the closed-date range metadata used by the Work items tab.
- `WorkItemsQuery.ts` — shared work-items fetch request and closed-date range types passed between the side panel and service worker.

