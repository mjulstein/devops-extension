[root](../../README.md) / [specs](../README.md) / 001-api-sidepanel-tab / spec.md

# Feature Specification: API Sidepanel Tab

**Feature Branch**: `[001-api-sidepanel-tab]`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User stories for a new sidepanel `API` tab that lets users discover Azure DevOps REST APIs, send authenticated requests from the extension, inspect results in the sidepanel console, and save reusable request macros.

## User Scenarios & Testing

### User Story 1 - Send authenticated Azure DevOps API requests from the side panel (Priority: P1)

A user opens a new `API` tab in the side panel, follows a prominent link to the Azure DevOps REST API reference, pastes a request URL from the docs, chooses an HTTP method, optionally enters a request body when the method supports one, and sends the request using the current authenticated browser session.

**Why this priority**: The core value of the feature is being able to try Azure DevOps APIs quickly without leaving the browser workflow or setting up external tools. If request composition and execution are not in place, the rest of the feature has no user value.

**Independent Test**: Open the side panel on an authenticated Azure DevOps session, navigate to the `API` tab, verify the documentation link is visible, submit a `GET` request copied from the Azure DevOps REST docs, then switch to a body-capable method and verify the request body input becomes available and the request is sent successfully.

**Acceptance Scenarios**:

1. **Given** the user opens the `API` tab, **When** the tab renders, **Then** it shows a clearly labeled link to the Azure DevOps API reference near the top of the tab.
2. **Given** the user pastes a valid Azure DevOps API URL and selects `GET`, **When** they submit the request, **Then** the extension issues the request through the active authenticated browser session and returns the response in the tab.
3. **Given** the user selects a method that supports a request body, **When** the method changes from `GET` to `POST`, `PUT`, or another body-capable method, **Then** a request body input is shown and the entered payload is included when the request is sent.
4. **Given** the user selects a method that does not support a request body, **When** the method changes back to `GET`, **Then** the body input is hidden or disabled and is not sent with the request.

---

### User Story 2 - Inspect, log, and copy request/response details (Priority: P2)

After sending a request, the user wants the response body to appear in the sidepanel console, to copy the most recent JavaScript request snippet into the browser devtools console, and to copy the most recent result into an editor for further review.

**Why this priority**: Once request execution exists, the next most important need is fast feedback and reuse. Logging and copy helpers reduce friction when comparing results, debugging failures, or moving an exploratory request into a manual workflow.

**Independent Test**: Send an API request from the `API` tab, confirm the response body is written to the in-panel console, then use separate controls to copy the last emitted JavaScript request and the last response body and verify both clipboard results match the most recent request cycle.

**Acceptance Scenarios**:

1. **Given** a request completes, **When** the response is received, **Then** the response body is logged to the sidepanel console in addition to being available in the `API` tab.
2. **Given** the user has sent at least one request, **When** they choose to copy the last JavaScript request, **Then** the clipboard receives a runnable JavaScript request snippet representing the most recent request that was actually sent.
3. **Given** the user has sent at least one request, **When** they choose to copy the last result, **Then** the clipboard receives the most recent response body in a text form suitable for pasting into an editor.
4. **Given** no request has been sent in the current session, **When** the user attempts to copy the last request or last result, **Then** the UI explains that no previous request/result is available yet.

---

### User Story 3 - Save and manage reusable request macros (Priority: P3)

A user wants to save the latest request as a reusable macro button that appears near the top of the `API` tab with newest items first. They also want to right-click a macro to open a modal where they can review the stored request, refine it, and delete it if it is no longer useful.

**Why this priority**: Saved macros are valuable once request execution and inspection are working, but they depend on the user first being able to compose and verify requests. This is powerful workflow acceleration rather than the base capability.

**Independent Test**: Send a request, save it as a macro, verify it appears at the top of the macro list, invoke it again from the saved button, then right-click it to edit its request details in a modal and delete it.

**Acceptance Scenarios**:

1. **Given** the user has sent a request, **When** they save the latest request as a macro, **Then** a new macro button appears in the `API` tab and is ordered before older saved macros.
2. **Given** multiple macros have been saved, **When** the list renders, **Then** the newest saved macro appears first.
3. **Given** a saved macro exists, **When** the user activates the macro button, **Then** the saved request details are restored or executed according to the macro behavior defined by the tab.
4. **Given** a saved macro exists, **When** the user right-clicks the macro, **Then** a modal opens that shows the stored request details and offers edit and delete actions.
5. **Given** the macro edit modal is open, **When** the user updates the request and saves it, **Then** the macro uses the revised request values thereafter.
6. **Given** the macro edit modal is open, **When** the user deletes the macro, **Then** the macro is removed from the list without affecting other saved macros.

## Edge Cases

- What happens when the user enters a malformed URL, an empty URL, or a non-Azure-DevOps URL?
- How does the tab behave when the active browser session is no longer authenticated and Azure DevOps returns an HTML sign-in page or authorization failure?
- What happens when the user enters invalid JSON into the request body for a method that expects JSON?
- How should large response bodies be logged and copied so the sidepanel remains usable?
- What happens when a macro references a request format from an older saved version after storage shape changes?
- How does right-click macro management behave on devices or browsers where context-menu behavior differs?
- What happens when the user attempts to resend or save a request while a prior request is still in flight?

## Requirements

### Functional Requirements

- **FR-001**: The system MUST add an `API` tab to the side panel navigation.
- **FR-002**: The `API` tab MUST show a prominent link to the official Azure DevOps REST API reference near the top of the tab.
- **FR-003**: Users MUST be able to enter an Azure DevOps API request URL in a multiline input area.
- **FR-004**: Users MUST be able to select the HTTP method for the request from a defined set of supported methods.
- **FR-005**: The system MUST show a request body input only for methods that allow a body and MUST exclude the body from methods that do not.
- **FR-006**: The system MUST send API requests using the current authenticated browser session and MUST NOT require personal access tokens or external backend services.
- **FR-007**: The system MUST surface the latest response body in the `API` tab and MUST also write the response body to the sidepanel console.
- **FR-008**: The system MUST retain the last successfully fired request details needed to generate a copyable JavaScript request snippet.
- **FR-009**: Users MUST be able to copy the most recent fired JavaScript request to the clipboard.
- **FR-010**: Users MUST be able to copy the most recent response result to the clipboard.
- **FR-011**: Users MUST be able to save the latest fired request as a reusable macro from the `API` tab.
- **FR-012**: The system MUST display saved macros near the top of the `API` tab in reverse chronological order, newest first.
- **FR-013**: The system MUST persist saved macros in browser-local storage in a backwards-compatible shape.
- **FR-014**: Users MUST be able to open a macro management modal from a right-click interaction on a saved macro.
- **FR-015**: The macro management modal MUST allow the user to review, update, and delete the selected macro.
- **FR-016**: The feature MUST keep `src/content-script.ts` generic and place Azure DevOps-specific request logic within the existing `src/devops/` and `src/sidepanel/` boundaries described by the repository constitution.
- **FR-017**: The system MUST provide clear validation or error feedback when a request cannot be sent or when the response cannot be parsed as expected.

### Key Entities

- **ApiRequestDraft**: The editable request state in the `API` tab, including URL, HTTP method, optional body, and any metadata needed before sending.
- **ApiRequestExecution**: The latest request actually fired, including the normalized URL, method, body, timestamp, and generated JavaScript snippet used for copy actions and console logging.
- **ApiResponseRecord**: The latest response details shown in the `API` tab and mirrored to the sidepanel console, including status, headers if needed later, and response body text.
- **ApiMacro**: A browser-local saved request preset that stores enough information to render a macro button, restore or execute the request, and support edit/delete actions.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A user can navigate from the `API` tab to the Azure DevOps REST API reference and manually execute a documented API request from the side panel without leaving the authenticated browser workflow.
- **SC-002**: After each request, the sidepanel console contains the corresponding response body and the user can copy both the last JavaScript request and the last response without re-running the request.
- **SC-003**: A user can save, reuse, edit, and delete request macros from the `API` tab, with newest saved macros appearing first across sidepanel sessions.

