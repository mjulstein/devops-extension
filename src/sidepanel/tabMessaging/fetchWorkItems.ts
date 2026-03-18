import type { FetchWorkItemsRequest, WorkItemResult } from '@/types';
import type { RuntimeResponse } from './runtimeResponse';

const PING_SERVICE_WORKER_TIMEOUT_MS = 3000;
const FETCH_WORK_ITEMS_TIMEOUT_MS = 45000;

export async function fetchWorkItems(
  request: FetchWorkItemsRequest
): Promise<RuntimeResponse<WorkItemResult>> {
  await withTimeout(
    chrome.runtime.sendMessage({ type: 'PING_SERVICE_WORKER' }),
    PING_SERVICE_WORKER_TIMEOUT_MS,
    'Service worker did not respond. Try Reload extension.'
  );

  return withTimeout(
    chrome.runtime.sendMessage({
      type: 'FETCH_WORK_ITEMS',
      payload: request
    }),
    FETCH_WORK_ITEMS_TIMEOUT_MS,
    'Timed out while waiting for work-item fetch response from service worker.'
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timerId = globalThis.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise.then(
      (value) => {
        globalThis.clearTimeout(timerId);
        resolve(value);
      },
      (error) => {
        globalThis.clearTimeout(timerId);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}
