[root](../../../README.md) / [src](../../README.md) / [sidepanel](../README.md) / tabMessaging

# `src/sidepanel/tabMessaging/`

This directory contains small messaging helpers that the side panel uses to talk to the service worker or the active Azure DevOps tab.

## Files in this directory

- `index.ts` — barrel export for the tab-messaging helpers.
- `runtimeResponse.ts` — shared `{ ok, result } | { ok, error }` response type used by messaging helpers.
- `sendMessageToActiveTab.ts` — sends runtime messages to the active tab and rewrites missing-receiver errors into a refresh hint.
- `getActiveTabId.ts` / `getActiveTabId.test.ts` — resolves the active browser tab id and tests that helper.
- `isAzureDevOpsUrl.ts` — identifies Azure DevOps URLs for navigation/link behavior.
- `isActiveTabAzureDevOps.ts` / `isActiveTabAzureDevOps.test.ts` — checks whether the current active tab is an Azure DevOps page.
- `fetchWorkItems.ts` / `fetchWorkItems.test.ts` — requests work-item fetches from the service worker with timeout handling.
- `getActiveWorkItemContext.ts` / `getActiveWorkItemContext.test.ts` — requests the active work-item context from the service worker.
- `createChildTask.ts` / `createChildTask.test.ts` — requests child-task creation for the current or selected parent.
- `fetchChildTasksForCurrentParent.ts` / `fetchChildTasksForCurrentParent.test.ts` — requests child-task lists for the resolved or selected parent.
- `setActiveWorkItemParent.ts` / `setActiveWorkItemParent.test.ts` — requests parent updates for the active work item or selected task.

