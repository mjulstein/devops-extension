[root](../README.md) / types

# `types/`

This directory contains shared TypeScript types imported through the `@/types` alias.

## Files in this directory

- `index.ts` — barrel export for the shared types.
- `ActiveWorkItemContext.ts` — types for the resolved active work-item context, including current item, detected parent, and viewed task.
- `ChildTaskItem.ts` — child-task summary shape used by the Active item tab.
- `CreatedChildTask.ts` — return type for child-task creation results.
- `ParentSuggestion.ts` — recent and pinned parent-suggestion types used by side-panel storage and UI.
- `Settings.ts` — persisted extension settings shape.
- `WorkItem.ts` — normalized work-item shape used by fetched results.
- `WorkItemResult.ts` — grouped open/closed work-item fetch result shape.

