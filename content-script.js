chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "PING_PAGE") {
        sendResponse({
            ok: true,
            title: document.title,
            url: window.location.href
        });
        return;
    }

    if (message.type === "TEST_AZDO_API") {
        testAzdoApi()
            .then((result) => sendResponse({ ok: true, result }))
            .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
    }

    if (message.type === "FETCH_WORK_ITEMS") {
        fetchWorkItems(message.payload)
            .then((result) => sendResponse({ ok: true, result }))
            .catch((error) => sendResponse({ ok: false, error: error.message }));
        return true;
    }
});

async function testAzdoApi() {
    const url = `${window.location.origin}/_apis/projects?api-version=7.0`;

    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
            Accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return {
        url,
        count: data.count,
        firstProjectName: data.value?.[0]?.name ?? null
    };
}

async function fetchWorkItems(settings) {
    const organization = (settings.organization || "").trim();
    const project = (settings.project || "").trim();
    const assignedTo = (settings.assignedTo || "").trim();

    if (!organization || !project || !assignedTo) {
        throw new Error("Missing organization, project, or assignedTo in settings.");
    }

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const weekAgoStr = formatDateForWiql(weekAgo);

    const wiql = `
        SELECT
            [System.Id]
        FROM WorkItems
        WHERE
            [System.TeamProject] = @project
          AND [System.AssignedTo] = '${escapeWiqlString(assignedTo)}'
          AND (
            [System.State] IN ('To Do', 'In Progress')
           OR (
            [System.State] = 'Closed'
          AND [Microsoft.VSTS.Common.ClosedDate] >= '${weekAgoStr}'
            )
            )
        ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC
    `;

    const wiqlUrl = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.0`;

    const wiqlResponse = await fetch(wiqlUrl, {
        method: "POST",
        credentials: "include",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: wiql })
    });

    if (!wiqlResponse.ok) {
        const text = await wiqlResponse.text();
        throw new Error(`WIQL failed: HTTP ${wiqlResponse.status} ${wiqlResponse.statusText}\n${text}`);
    }

    const wiqlData = await wiqlResponse.json();
    const ids = (wiqlData.workItems || []).map((x) => x.id);

    if (!ids.length) {
        return {
            count: 0,
            items: []
        };
    }

    const fields = [
        "System.Id",
        "System.Title",
        "System.State",
        "System.AssignedTo",
        "System.Parent",
        "Microsoft.VSTS.Common.ClosedDate"
    ];

    const idChunks = chunkArray(ids, 50);
    const allItems = [];

    for (const chunk of idChunks) {
        const workItemsUrl =
            `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}` +
            `/_apis/wit/workitems?ids=${chunk.join(",")}` +
            `&fields=${encodeURIComponent(fields.join(","))}` +
            `&api-version=7.0`;

        const workItemsResponse = await fetch(workItemsUrl, {
            method: "GET",
            credentials: "include",
            headers: {
                Accept: "application/json"
            }
        });

        if (!workItemsResponse.ok) {
            const text = await workItemsResponse.text();
            throw new Error(`Work items fetch failed: HTTP ${workItemsResponse.status} ${workItemsResponse.statusText}\n${text}`);
        }

        const workItemsData = await workItemsResponse.json();
        allItems.push(...(workItemsData.value || []));
    }

    const items = allItems.map((item) => {
        const id = item.fields["System.Id"];
        const title = (item.fields["System.Title"] || "").trim();
        const state = item.fields["System.State"] || "";
        const assignedToValue = normalizeAssignedTo(item.fields["System.AssignedTo"]);
        const parentId = item.fields["System.Parent"] || null;
        const closedDate = item.fields["Microsoft.VSTS.Common.ClosedDate"] || null;
        const url = `https://dev.azure.com/${organization}/${project}/_workitems/edit/${id}`;

        return {
            id,
            title,
            state,
            assignedTo: assignedToValue,
            parentId,
            closedDate,
            url
        };
    });

    const openItems = items.filter((item) => item.closedDate === null);
    const closedItems = items.filter((item) => item.closedDate !== null);

    return {
        count: items.length,
        openItems,
        closedItems
    };
}

function chunkArray(items, size) {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}

function formatDateForWiql(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function escapeWiqlString(value) {
    return String(value).replace(/'/g, "''");
}

function normalizeAssignedTo(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
        return value.displayName || value.uniqueName || "";
    }
    return String(value);
}