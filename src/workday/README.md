[root](../../README.md) / [src](../README.md) / workday

# Last working day

A dashboard window, opened by typing `!` alone in the favorites search, that
shows what you did on your last working day and what that day left open.

A **working day** is a local-time day with at least N of your own work-item
changes (Settings → **Insights**, default 3), so weekends, vacations and the
odd stray comment fall away by themselves. The search starts at yesterday and
covers 15 days; **← Back** and **Forward →** step between working days, and
Back past the last one searches the 15 days before. A working day takes the
quiet days after it along, up to the next working day or yesterday, so a few
changes on a weekend show with the Friday before; the heading names the range
only as far as there were changes. Quiet days inside a stretch already
recorded as empty were never fetched, so they are not joined. A 15-day window that held
no working day is remembered in `chrome.storage.local` under
`workDayEmptyRanges`, keyed on user and N, and never searched again.

"You" is the `assignedTo` setting, or the signed-in user when it is empty.

## Files

- `WorkDayApp.tsx` + `WorkDayApp.module.css` — the page: heading, the day's
  items on the left, loose ends top right, quick tasks bottom right.
- `useWorkDay.ts` — loading, the window search and Back / Forward.
- `useQuickTasksFeed.ts` — feeds the side panel's own `QuickTaskList`
  unchanged, through the same messages and pinned ids as the panel. The
  bookmark mirror stays the panel's job. Each loose end carries **✎ Follow
  up**, which only drafts: it fills the title box with `Follow up: <title>` and
  keeps the item's url to write into the new task's description as a plain
  hyperlink. Nothing is created until you press create, and the task is never
  related to or mentions the item.

The pure logic (day keys, windows, change summaries, loose ends) lives in
[`src/devops/workDay.ts`](../devops/workDay.ts) and the calls in
[`src/devops/workDayApi.ts`](../devops/workDayApi.ts).
