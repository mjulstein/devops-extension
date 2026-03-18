[root](../../README.md) / [src](../README.md) / devops

# `src/devops/`

This directory contains Azure DevOps-specific logic. Keep `src/content-script.ts` generic and place selectors, URL parsing, work-item context resolution, and REST operations here.

## Files in this directory

- `activeParentContext.ts` — resolves the current work item, detected parent, and viewed task context from the active Azure DevOps URL and fetched work-item details.
- `activeWorkItemDom.ts` — detects the visually active work item id from Azure DevOps panels, dialogs, and main page surfaces.
- `childTasks.ts` — loads child task relations and task summaries for the resolved or selected parent work item.
- `lastVisitedContext.ts` — creates and parses persisted last-visited org/project and work-item references for service-worker fallback behavior.
- `lastVisitedContext.test.ts` — Vitest coverage for last-visited context parsing and normalization.
- `parentAssignment.ts` — updates parent relations for the active work item or a selected task.
- `taskCreation.ts` — creates a new child task under the resolved parent work item.
- `typeGuards.ts` — small shared guards/helpers for Azure DevOps API responses.
- `urlContext.ts` — derives organization, project, and work-item ids from Azure DevOps URLs.
- `workItemDetails.ts` — fetches work-item metadata used for parent resolution, validation, and task creation defaults.
- `workItems.ts` — runs separate open/closed assigned-to WIQL queries, applies the selected closed-date range, and transforms work-item results with optional parent summaries for the side panel.

