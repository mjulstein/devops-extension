[root](../../../README.md) / [src](../../README.md) / [sidepanel](../README.md) / work-items

# `src/sidepanel/work-items/`

This directory contains the Work items tab UI.

## Files in this directory

- `index.ts` — barrel export for the main work-items status card.
- `WorkItemsPane.tsx` + `StatusCard.module.css` — Work items tab layout composition for toolbar, status notices, closed-date controls, and open/closed sections.
- `WorkItemSection.tsx` + `WorkItemSection.module.css` — titled work-item list composition for flat and grouped work-item displays.
- `WorkItemsPane.test.tsx` — render coverage for the loading rules: rows persist through a refresh, and the created-task notice stays a one-click link.

## Subdirectories

- [`atoms`](./atoms/README.md) — reusable toolbar, tab-strip, date-range, row, list, and grouped closed-date atoms for the Work items tab, plus sorting/grouping/staleness helpers.
