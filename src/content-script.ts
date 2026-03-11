import type { Settings } from '@/types';
import { resolveActiveWorkItemContext } from './devops/activeParentContext';
import { fetchChildTasksForActiveParent } from './devops/childTasks';
import { createChildTaskFromActivePage } from './devops/taskCreation';
import { fetchWorkItems } from './devops/workItems';

type RuntimeMessage =
  | {
      type: 'FETCH_WORK_ITEMS';
      payload: Settings;
    }
  | {
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT';
    }
  | {
      type: 'CREATE_CHILD_TASK';
      payload: {
        title: string;
      };
    }
  | {
      type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT';
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
      resolveActiveWorkItemContext(window.location.href)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'CREATE_CHILD_TASK') {
      createChildTaskFromActivePage(message.payload.title, window.location.href)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }

    if (message.type === 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT') {
      fetchChildTasksForActiveParent(window.location.href)
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error: Error) =>
          sendResponse({ ok: false, error: error.message })
        );
      return true;
    }
  }
);
