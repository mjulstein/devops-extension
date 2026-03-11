import type { Settings } from '@/types';
import { resolveActiveWorkItemContext } from './devops/activeParentContext';
import { fetchChildTasksForActiveParent } from './devops/childTasks';
import { createChildTaskFromActivePage } from './devops/taskCreation';
import { fetchWorkItems } from './devops/workItems';
import { setParentForActiveWorkItem } from './devops/parentAssignment';
import { detectActiveWorkItemId } from './devops/activeWorkItemDom';

type RuntimeMessage =
  | {
      type: 'FETCH_WORK_ITEMS';
      payload: Settings;
    }
  | {
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT';
      payload?: {
        forceResync?: boolean;
      };
    }
  | {
      type: 'CREATE_CHILD_TASK';
      payload: {
        title: string;
        preferredParentId?: number;
      };
    }
  | {
      type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT';
      payload?: {
        preferredParentId?: number;
      };
    }
  | {
      type: 'SET_ACTIVE_WORK_ITEM_PARENT';
      payload: {
        parentId: number;
      };
    };

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === 'FETCH_WORK_ITEMS') {
      fetchWorkItems(message.payload)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'GET_ACTIVE_WORK_ITEM_CONTEXT') {
      const detectedWorkItemId = detectActiveWorkItemId(
        Boolean(message.payload?.forceResync)
      );

      resolveActiveWorkItemContext(
        window.location.href,
        undefined,
        detectedWorkItemId
      )
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'CREATE_CHILD_TASK') {
      createChildTaskFromActivePage(
        message.payload.title,
        window.location.href,
        message.payload.preferredParentId
      )
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT') {
      fetchChildTasksForActiveParent(
        window.location.href,
        message.payload?.preferredParentId
      )
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'SET_ACTIVE_WORK_ITEM_PARENT') {
      setParentForActiveWorkItem(window.location.href, message.payload.parentId)
        .then(() => sendResponse({ ok: true, result: null }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }
  }
);
