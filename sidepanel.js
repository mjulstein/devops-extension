const DEFAULT_SETTINGS = {
    organization: "",
    project: "",
    assignedTo: ""
};

const organizationInput = document.getElementById("organizationInput");
const projectInput = document.getElementById("projectInput");
const assignedToInput = document.getElementById("assignedToInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const testBtn = document.getElementById("testBtn");
const pingPageBtn = document.getElementById("pingPageBtn");
const fetchWorkItemsBtn = document.getElementById("fetchWorkItemsBtn");
const output = document.getElementById("output");
const debugOutput = document.getElementById("debugOutput");const loadingState = document.getElementById("loadingState");
function setLoading(isLoading, message = "Loading…") {
    const buttons = [
        testBtn,
        pingPageBtn,
        testApiBtn,
        fetchWorkItemsBtn,
        saveSettingsBtn
    ].filter(Boolean);

    for (const button of buttons) {
        button.disabled = isLoading;
    }

    loadingState.textContent = message;
    loadingState.classList.toggle("hidden", !isLoading);
}

async function loadSettings() {
    const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);

    organizationInput.value = stored.organization || "";
    projectInput.value = stored.project || "";
    assignedToInput.value = stored.assignedTo || "";

    output.textContent = "Settings loaded.";
}

async function saveSettings() {
    const settings = {
        organization: organizationInput.value.trim(),
        project: projectInput.value.trim(),
        assignedTo: assignedToInput.value.trim()
    };

    await chrome.storage.local.set(settings);
    output.textContent = "Settings saved.";
}

async function showStoredSettings() {
    const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
    output.textContent = JSON.stringify(stored, null, 2);
}
async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
}

async function pingCurrentPage() {
    try {
        const tab = await getActiveTab();

        if (!tab?.id) {
            output.textContent = "No active tab found.";
            return;
        }

        const response = await chrome.tabs.sendMessage(tab.id, { type: "PING_PAGE" });
        output.textContent = JSON.stringify(response, null, 2);
    } catch (error) {
        output.textContent = `Could not talk to current page.\n\n${error.message}`;
    }
}
function createSectionHeading(text) {
    const h3 = document.createElement("h3");
    h3.textContent = text;
    return h3;
}

function buildListOrEmpty(items, emptyText) {
    if (!items.length) {
        const p = document.createElement("p");
        p.textContent = emptyText;
        return p;
    }

    const ul = document.createElement("ul");

    for (const item of items) {
        const li = document.createElement("li");

        const link = document.createElement("a");
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = `${item.id} - ${item.title}`;

        li.appendChild(link);
        ul.appendChild(li);
    }

    return ul;
}
function renderWorkItems(result) {
    const openItems = result?.openItems || [];
    const closedItems = result?.closedItems || [];

    output.innerHTML = "";

    output.appendChild(createSectionHeading("TODO"));
    output.appendChild(buildListOrEmpty(openItems, "No open items."));

    output.appendChild(createSectionHeading("Closed last week"));
    output.appendChild(buildListOrEmpty(closedItems, "No recently closed items."));
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
async function fetchWorkItems() {
    try {
        const tab = await getActiveTab();

        if (!tab?.id) {
            output.textContent = "No active tab found.";
            return;
        }

        const settings = await chrome.storage.local.get({
            organization: "",
            project: "",
            assignedTo: ""
        });

        setLoading(true, "Fetching work items…");
        output.innerHTML = "";
        debugOutput.textContent = "Loading…";

        const response = await chrome.tabs.sendMessage(tab.id, {
            type: "FETCH_WORK_ITEMS",
            payload: settings
        });

        debugOutput.textContent = JSON.stringify(response, null, 2);

        if (!response?.ok) {
            output.innerHTML = "<p>Fetch failed.</p>";
            return;
        }
        renderWorkItems(response.result);

    } catch (error) {
        output.innerHTML = "";
        debugOutput.textContent = `Could not fetch work items.\n\n${error.message}`;
    } finally {
        setLoading(false);
    }
}

saveSettingsBtn.addEventListener("click", saveSettings);
testBtn.addEventListener("click", showStoredSettings);
pingPageBtn.addEventListener("click", pingCurrentPage);
fetchWorkItemsBtn.addEventListener("click", fetchWorkItems);

loadSettings();