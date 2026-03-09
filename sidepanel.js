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
const output = document.getElementById("output");

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
saveSettingsBtn.addEventListener("click", saveSettings);
testBtn.addEventListener("click", showStoredSettings);
pingPageBtn.addEventListener("click", pingCurrentPage);

loadSettings();