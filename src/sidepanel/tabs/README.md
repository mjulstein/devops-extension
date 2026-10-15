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
  See [`tabGroups.ts`](../tabGroups.ts) and
  [`tabGroupPattern.ts`](../tabGroupPattern.ts).

A definition starts as a bare domain, which matches it and everything under it.
Past that it is a pattern: `wiki.*​/spaces`, `localhost:3000`,
`http://*:1234/path`. `*` stands for any run of characters, a port is as much
part of an address as a path, and the scheme is https unless another is written
— which is the same bargain a typed address makes in the app commands.

A configured group stays on the list with nothing in it. It is somewhere you
said you go, and empty is exactly when you want the **＋** that opens the first
tab there. That button appears only where the pattern names one place: a
wildcard describes many addresses and picks none.

Rows are ordered oldest first, then by address, so the tabs you have not touched
come to the top and one repo's tabs sit together. A tab whose age the browser
does not report sorts last — the rule `staleTabs.ts` uses, because not knowing
how old something is is not the same as it being old.

Each group's heading carries its own cleanup: a days box and a button that
closes that group's tabs untouched for that long, asking first. It keeps the
protections the global one has — a pinned, active or audible tab is in use —
because scoping an action should narrow what it touches, not what it spares.
The days start from the saved threshold on Settings → Tools and are not
remembered per group: it is a number you reach for while tidying one section,
not a preference about it. The controls stop the click there, so pressing them
does not also fold the group away under your hand.

The heading is also the disclosure: clicking it folds the group into a
`<details>`. Open or closed is held by the page rather than the DOM, because the
list re-renders on every tab event and a group that sprang open each time a tab
moved would be unusable. The icon beside a group's name is the favicon of its
newest tab — the newest rather than the first, because the first changes when
you flip the order and an icon that moves with the sort is telling you about the
sort.

**Repos** is sectioned again, per repository: five tabs across three
repositories is three things, not five. Every other section is a list of pages
of one kind, so it stays flat.

The **✕** sits to the left of the name. Closing is what the list is mostly for,
and reaching past a title to find an x at the end of a ragged row is the slower
half of doing it. The name is the control that switches, so the thing you read
is the thing you press.
