import { fetchWorkItems } from './devops/workItems';

type RuntimeMessage = {
  type: 'FETCH_WORK_ITEMS';
  payload: {
    assignedTo: string;
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
  }
);
