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
- **Everything else** comes from the app folders in your bookmarks. See
  [`appGroups.ts`](../appGroups.ts).

An app is a folder under the favorites folder's `Apps`, and the folder's **name
is the rule**: a host. That is the part of a bookmark that syncs, so the group
definitions reach another machine the way everything else here does. Every tab
on that host belongs to the group, bookmarked or not. Where two folders could
both take a tab — `base.com` and `sub.base.com` — the longer name wins, because
a folder named for a sub-domain exists precisely to separate it out and
counting the tab twice would make both groups lie.

Folders are one level and flat. The bookmarks inside are the few main addresses
— the ones worth having on a machine with no extension — not a list of
everywhere you have been. How a host's open pages are then arranged is this
panel's business, not something to be written into somebody's bookmarks and
synced to every machine they own.

A bookmark with nothing open at its address shows as a row that opens one; a
bookmark whose address already has a tab drops out, since the tab is the thing
to act on and the bookmark has already done its job by putting it in this
group.

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

## Sub-groups

A folder inside an app folder is drawn under it, holding the tabs its own name
covers. Those tabs leave the app's own list rather than appearing twice, and
where two sub-groups could take a tab the longer name wins — a narrower rule
exists precisely to separate something out.

The names are made in the bookmark manager, typed with a `*` for the app's own
name. See [`src/sidepanel/apps/README.md`](../apps/README.md).

## Dragging a group

The handle is the **⠿** grip beside the heading, and it sits outside the
`<summary>`. The heading itself was the handle first, which read better and did
not work: a summary is the disclosure control, and Chrome will not start a drag
from one that has been laid out as anything but a summary. An explicit grip is
also the honest answer to "where am I supposed to grab this" — a row that can
be dragged from some unmarked part of itself is a row nobody drags.

The gaps between groups are in the list all along with no height, and open only
while a drag is on. Inserting them when the drag starts rearranges the page
under the cursor at the moment the browser is deciding what is being dragged.

## The tab you are looking at

The row for the tab its window is showing is marked. Clicking a row switches to
that tab, and without the mark the list looks exactly as it did before.
