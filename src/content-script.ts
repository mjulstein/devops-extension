import { fetchWorkItems, testAzdoApi } from "./devops/workItems";

type RuntimeMessage =
  | { type: "PING_PAGE" }
  | { type: "TEST_AZDO_API" }
  | {
      type: "FETCH_WORK_ITEMS";
      payload: {
        assignedTo: string;
      };
    };

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "PING_PAGE") {
    sendResponse({
      ok: true,
      title: document.title,
      url: window.location.href
    });
    return;
  }

  if (message.type === "TEST_AZDO_API") {
    testAzdoApi(window.location.origin)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: Error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "FETCH_WORK_ITEMS") {
    fetchWorkItems(message.payload)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error: Error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
