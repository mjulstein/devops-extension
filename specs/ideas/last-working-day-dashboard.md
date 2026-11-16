[root](../../README.md) / [specs](../README.md) / [ideas](./README.md) / last-working-day-dashboard

# Last working day dashboard

## Value

The extension exists to give at-a-glance insight into one's own work. Today it shows
what is open; it does not show what was *done*. After a weekend or a vacation, the
question "where was I?" is answered by clicking through work item histories. This page
answers it in one look, and starts an **Insights** role for the extension.

## User flow

1. Type `!` alone in the favorites palette. A window of its own opens through
   `openSingletonWindow` (one at a time, bounds remembered), like the bookmark manager.
2. The page finds the **last working day** and shows it under a heading that says what
   is being looked at, for example: *Tuesday 10 Nov · 14 changes across 6 items · last
   working day before today*.
3. **Back** / **Forward** step to the previous / next working day when the automatic
   pick was not the one wanted.

## Definitions

- **Subject user** — the existing user setting (`assignedTo`); empty means `@me`. Every
  query on the page uses it, including the loose-ends queries that today use `@Me`
  directly.
- **Activity** — work item changes made by the subject user: field and state changes,
  comments, created items. Commits, PRs and page visits are out of scope.
- **Working day** — a local-time calendar day (midnight to midnight, browser time zone)
  with at least **N** changes by the subject user. N is a setting, default 3.

## Search

- Start at yesterday and walk back one day at a time, within a **15-day window**.
- If the window holds no working day, the heading says so (*No working day with ≥ N
  changes in the last 15 days*); Back searches the next 15 days.
- A window searched and found empty is recorded in `chrome.storage.local`, keyed on
  subject user + N, and never searched again, across back/forward and across reopens.
  Past days do not change, so the record stays valid. Changing the user setting or N
  invalidates it (lowering N can turn a skipped day into a working day).
- Back / Forward step by working day, skipping non-qualifying days exactly as the
  initial search does.

## Layout

Two columns, dashboard style.

- **Left** — one `WorkItemRow` per item touched that day, with a short summary of what
  was done to it (`→ In Progress`, `commented`, `created`), ordered by the latest change.
- **Right, top** — loose ends from that day:
  - items moved to In Progress that day and still in it,
  - items created that day with no parent (the Orphans rule, `describeParentMismatch`),
  - handovers: moved into a state by the subject user, now held by someone else
    (the `inProgressByMe` model).
- **Right, bottom** — reserved for quick tasks. First iteration renders the existing
  `QuickTaskList` unchanged. It is presentational (all data and handlers come as props
  from `useSidepanelController`), so the page needs its own wiring to feed it; if that
  wiring cannot be reused without changing the component, render an empty labelled box
  instead. Reinventing quick tasks is out of scope.

## Settings

A new **Insights** region on the Settings tab, holding N (default 3). Future dashboard
settings go here too.

## Implementation notes

- Querying: WIQL `[System.ChangedBy] EVER <user>` with a `ChangedDate` lower bound to find
  candidates, then each candidate's `/updates` filtered to the subject user and bucketed
  by local day, the same confirmation pattern `inProgressByMeApi.ts` uses. Lives under
  `src/devops/`; data calls go through the runtime PAT (`authFetch`). No scope change:
  `vso.work_write` covers it.
- Page entry: `src/insights.html` + `src/insights.tsx` + `src/insights/*`, a new Vite
  entry beside `bookmarks` and `windows`.
- `!` prefix: handled in `favoritesQuery.ts` next to `#`, `.`, `-` and `>`.
- No organization, project or user value is ever committed; all come from settings or
  the last visited context.

## Deferred

- Code activity (commits, PRs) as activity, which widens what the PAT is used for.
- A changes-per-day chart over recent weeks.
- Grouping the left column by parent.
- A day-start hour other than midnight.

## Open questions

- Exact wording of the per-item change summary for multi-field edits.
- How many `/updates` calls a busy 15-day window costs, and whether results per day
  should be cached like the empty windows.

## Promotion criteria

Promote to a numbered spec once the query cost is measured on a real account and the
quick-task wiring decision (reuse vs. placeholder) is made.
