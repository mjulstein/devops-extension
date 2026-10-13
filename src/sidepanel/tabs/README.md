[root](../../../README.md) / [src](../../README.md) / [sidepanel](../README.md) / tabs

# `src/sidepanel/tabs`

The **Tabs** tab: every open tab worth grouping, in one place.

| File | What it holds |
| --- | --- |
| [`TabsPane.tsx`](./TabsPane.tsx) | The sidebar tab itself. |
| [`TabGroupList.tsx`](./TabGroupList.tsx) | A group and its rows, drawing its own children so a narrowed group and a plain one are the same component. |

The groups come from two places and sit at the same level, because by the time
you are looking at this you are asking "what have I got open", not "what kind of
thing is it":

- **Azure DevOps** is grouped by its own sections through `adoSectionOf`, the
  same function the favicons use, so the grouping and the icons cannot come to
  disagree about what a page is.
- **Everything else** comes from the domains configured on Settings → Tools.
  See [`tabGroups.ts`](../tabGroups.ts).

Rows are ordered oldest first, then by address, so the tabs you have not touched
come to the top and one repo's tabs sit together. A tab whose age the browser
does not report sorts last — the rule `staleTabs.ts` uses, because not knowing
how old something is is not the same as it being old.

The **✕** sits to the left of the name. Closing is what the list is mostly for,
and reaching past a title to find an x at the end of a ragged row is the slower
half of doing it. The name is the control that switches, so the thing you read
is the thing you press.
