[root](../README.md) / src

# `src/`

This directory contains the extension runtime entry points, build-time manifest template, and the main source modules.

Keep this document shallow: describe the files that live directly in `src/` and link to child directory `README.md` files for deeper details.

## Files in this directory

- `content-script.ts` — generic runtime message bridge between extension UI requests and Azure DevOps-specific modules.
- `manifest.json` — Manifest V3 template copied into `dist/` during the build.
- `service-worker.ts` — background entry point that handles runtime messages, performs range-aware work-item fetches, and records last visited Azure DevOps context in `chrome.storage.local`.
- `sidepanel.html` — HTML shell for the side panel bundle; styling is emitted from the side panel entry's imported CSS modules.
- `sidepanel.tsx` — React entry point that renders `sidepanel/App.tsx` into `#app`.

## Subdirectories

- [`devops`](./devops/README.md) — Azure DevOps-specific DOM detection, URL/context parsing, REST calls, and work-item operations.
- [`sidepanel`](./sidepanel/README.md) — side panel state, storage helpers, navigation chrome, and runtime messaging helpers.


