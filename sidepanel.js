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

saveSettingsBtn.addEventListener("click", saveSettings);
testBtn.addEventListener("click", showStoredSettings);

loadSettings();