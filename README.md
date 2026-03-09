# Azure DevOps Daily Work Item Export (Edge Extension)

A Microsoft Edge extension that generates a quick summary of Azure
DevOps work items assigned to a specific user.

The extension runs inside the browser and uses the currently
authenticated Azure DevOps session to query work items through the Azure
DevOps REST API. No personal access tokens or additional authentication
are required.

Results are displayed in the side panel as clickable links grouped into:

-   **TODO** -- active work items assigned to the configured user
-   **Closed last week** -- work items assigned to the user that were
    completed within the last 7 days

A raw JSON response is also available in a collapsible section for
debugging.

## Features

-   Uses the existing Azure DevOps login session
-   No API tokens required
-   Fetches work items using WIQL and the Azure DevOps REST API
-   Displays clickable links to each work item
-   Groups work items into active and recently completed
-   Shows raw response data for debugging
-   Runs entirely inside the browser

## Project Structure

    devops-extension/
    ├─ manifest.json
    ├─ service-worker.js
    ├─ content-script.js
    ├─ sidepanel.html
    ├─ sidepanel.js
    ├─ sidepanel.css
    ├─ config.local.json
    └─ .gitignore

## Key Files

### manifest.json

Defines the extension configuration, permissions, and side panel entry
point.

### service-worker.js

Initializes extension behavior and configures the side panel.

### content-script.js

Runs inside Azure DevOps pages and is responsible for: - executing WIQL
queries - calling the Azure DevOps REST API - building the structured
result returned to the UI

### sidepanel.html

The user interface shown in the browser side panel.

### sidepanel.js

Handles user interaction, triggers work item queries, and renders the
results.

### sidepanel.css

Provides styling for the side panel.

## Configuration

The extension stores runtime settings in browser storage.

Example structure:

``` json
{
  "organization": "<organization>",
  "project": "<project>",
  "assignedTo": "<user display name>"
}
```

A local `config.local.json` file can be used for development and should
be kept out of version control.

## Installing for Development

1.  Clone the repository.
2.  Open Microsoft Edge.
3.  Navigate to `edge://extensions`
4.  Enable **Developer mode**
5.  Click **Load unpacked**
6.  Select the extension directory

## Usage

1.  Open any Azure DevOps page.
2.  Open the extension side panel.
3.  Click **Fetch work items**.

The extension will query Azure DevOps using the current browser session
and display the matching work items in the side panel.

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and-or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
