import type { Settings } from '@/types';
import type { OrphanCandidate } from '@/devops/orphanWorkItems';
import { expectRuntimeResponse, type RuntimeResponse } from './runtimeResponse';

// Fetched on demand when the Orphans tab is opened: it asks for every work item
// you raised of the relevant types and filters them on the parent field that
// came back, which is more than the other lists read and is not something to do
// on the path that renders them.
export async function fetchOrphanWorkItems(
  settings: Settings
): Promise<RuntimeResponse<OrphanCandidate[]>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'FETCH_ORPHAN_WORK_ITEMS',
      payload: { settings }
    }),
    'FETCH_ORPHAN_WORK_ITEMS'
  );
}

export interface ParentWorkItemsRequest {
  settings: Settings;
  /**
   * The items to move, each with its type. The type travels with the request
   * because the hierarchy check happens next to the write, where the parent's
   * own type is known — the panel never sees it, since a Feature is not in the
   * list it is showing.
   */
  items: { id: number; workItemType: string }[];
  parentId: number;
}

export interface ParentWorkItemsResult {
  parented: number[];
  failed: { id: number; reason: string }[];
  /** Left alone because the hierarchy does not allow it, with the reason. */
  refused: { id: number; reason: string }[];
}

export async function parentWorkItems(
  request: ParentWorkItemsRequest
): Promise<RuntimeResponse<ParentWorkItemsResult>> {
  return expectRuntimeResponse(
    await chrome.runtime.sendMessage({
      type: 'PARENT_WORK_ITEMS',
      payload: request
    }),
    'PARENT_WORK_ITEMS'
  );
}
