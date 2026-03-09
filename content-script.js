chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PING_PAGE") {
        sendResponse({
            ok: true,
            title: document.title,
            url: window.location.href
        });
    }
});