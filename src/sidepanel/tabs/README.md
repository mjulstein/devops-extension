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
- **Everything else** comes from the domains configured on Settings → Apps.
  See [`tabGroups.ts`](../tabGroups.ts) and
  [`tabGroupPattern.ts`](../tabGroupPattern.ts).

A definition starts as a bare domain, which matches it and everything under it.
Past that it is a pattern: `wiki.*` followed by `/spaces`, `localhost:3000`,
`http://*:1234/path`. `*` stands for any run of characters, a port is as much
part of an address as a path, and the scheme is https unless another is written
— which is the same bargain a typed address makes in the app commands.

A configured group stays on the list with nothing in it. It is somewhere you
said you go, and empty is exactly when you want the **＋** that opens the first
tab there. That button appears only where the pattern names one place: a
wildcard describes many addresses and picks none.

Whatever landed in no group at all comes last, under **Other**, grouped by
host. A list of what you have open that says nothing about most of it is not a
list of what you have open. Each host there carries **📌**, which makes it a
configured group of its own and saves outright — it is a decision taken where
the group is, and leaving it pending on a tab you are not looking at would lose
it. Other disappears when everything is claimed: an empty catch-all is noise,
and unlike a configured group nobody asked for it.

The catch-all sits on its own background, so it is plain where the groups you
defined stop and the leftovers begin.

Top-level groups are dragged by their heading. A `<summary>` is an interactive
control in its own right, so a drag starting on it never reaches a draggable
parent — with `draggable` on the `<details>` the only surface that worked was
the body, which from the outside is a handle in an arbitrary place.

Top-level groups can be dragged to reorder. Only the top level: a narrowed
group's sub-groups are in the order its rules are, and the catch-all's are
alphabetical, so there is nowhere to record a different one.

While a drag is in progress a gap opens on each side of every group, and the
one under the pointer draws a line where the group will land. The gaps are only
there during the drag — a permanent one between every group would be a list
with holes in it — and the line is on the gap rather than on a group's edge, so
what you see is where the thing goes.

What is recorded is the order of *every* top-level key, the built-in sections
included, in `tabGroupKeyOrder`. The first version reordered the settings, which
meant dragging an Azure DevOps section or the catch-all did nothing at all — and
from the outside that is indistinguishable from dragging being broken. What is
being arranged is the list in front of you, not the settings behind it. A key
with no stored position keeps its natural place after the ones that have one, so
a section that turns up later is added rather than hidden.

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

**Ctrl**- or **Cmd**-clicking a tab duplicates it instead of switching: the
browser's own convention for "and keep this one", which here means a second tab
rather than going to the one you have.

A bookmark and a tab are the same place when their domain and path agree. The
query is ignored, because a bookmark names a place and a query names a view of
it — two tabs on one path with different parameters are variants of one thing,
and a bookmark that insisted on an exact query would sit there offering to open
a page already in front of you. A bookmark with a tab at its address is left out
of the list: the tab is the thing to act on, and the bookmark has already done
its job by putting that tab in this group.

The **✕** sits to the left of the name. Closing is what the list is mostly for,
and reaching past a title to find an x at the end of a ragged row is the slower
half of doing it. The name is the control that switches, so the thing you read
is the thing you press.
