[root](../../README.md) / [src](../README.md) / bookmarks

# `src/bookmarks`

The extension's own bookmark manager page, opened from the **Bookmarks** button
in the favorites palette.

It exists because the browser's manager is a file browser and nothing more: it
cannot say what is saved twice, what is filed in two places, or what folders are
now empty, which is most of the work of keeping bookmarks usable. This page puts
those three lists under the organiser and gives every row the same three actions
— edit, delete, move — so a problem is fixed where it is found.

| File | What it holds |
| --- | --- |
| [`bookmarksModel.ts`](./bookmarksModel.ts) | The pure rules: flattening the tree, the two kinds of duplicate, empty folders, the filters, and whether a drag may land where it was dropped. No browser API, so it is all testable. |
| [`bookmarksApi.ts`](./bookmarksApi.ts) | The `chrome.bookmarks` calls, in one place, plus a subscription that reloads the tree on any change — including one made in another window or synced in from another machine. |
| [`BookmarksApp.tsx`](./BookmarksApp.tsx) | The page: header search, the folder tree beside the selected folder's contents, and the issue lists below. |
| [`FolderTree.tsx`](./FolderTree.tsx) | Every folder, nested, each one a drop target, each with collapse, rename and delete. |
| [`BookmarkRow.tsx`](./BookmarkRow.tsx) | One bookmark row, the same in the organiser and in every issue list. |
| [`IssuesPanel.tsx`](./IssuesPanel.tsx) | The **Duplicate name** / **Duplicate path** / **Duplicate folder** / **Empty folders** tabs, each with its own filter. |

## Two kinds of duplicate

**Duplicate name** is bookmarks sharing a title, wherever they live: a list of
identical rows cannot be used, and which one to keep is a judgement only the
reader can make.

**Duplicate path** compares addresses with their search params and hash removed,
and only reports a group whose members sit in *different* folders. Two copies
inside one folder are already side by side in the organiser; the case worth
surfacing is the same page filed twice where neither copy is visible from the
other.

## Folder rows

Rename and delete sit on the row rather than in a menu, so a folder is fixed
where it is seen — the same bargain the bookmark rows make. They appear on hover
or keyboard focus: shown always, a tree of folders becomes a wall of icons.

Flattening lifts a folder's contents into its grandparent and removes the empty
shell, so only the one level named disappears and the nesting underneath comes
along untouched. The children land at the folder's own position rather than at
the end of the list, so flattening does not quietly reorder the list as well.
`planFlatten` returns null — and the button is hidden — for an empty folder,
where flattening would just be a delete, and for a root, whose parent is the
hidden node that cannot hold bookmarks.

Deleting a folder takes everything under it and, unlike a bookmark, that is not
something the address bar can give back, so a non-empty folder asks first. An
empty one goes without the interruption. The selection is cleared when its own
folder is deleted, since a selection pointing at a deleted id shows an empty
contents pane with no way to tell why.

The tree tracks which folders are *collapsed* rather than which are expanded, so
a folder created here or synced in from another machine is open by default
instead of hidden until someone thinks to look for it.

## Selection, scope and reveal

Three different things, deliberately kept apart:

- **Checked** rows are the bulk selection, shared by both halves so a duplicate
  can be ticked where it is found and moved or deleted with the rest. The set is
  filtered against the live tree on every render, so a row deleted elsewhere
  cannot leave a count that nothing can act on.
- **Selected** is the folder shown in the tree and opened in the contents pane.
- **Scoped** is what the issue lists describe. It follows a folder chosen in the
  tree, but *not* one reached by clicking a duplicate: narrowing the lists to the
  folder you just jumped to would drop the counterpart you were comparing with.

## Scope

The lists describe whichever tree `BookmarksApp` hands them, which is the whole
thing until a folder is selected and that subtree afterwards. A duplicate matters
where you are working; in a whole-tree list the two copies just made go
unnoticed. `scopeLabel` names the folder above the lists so a short list is never
read as nothing left to fix.

The folder rows in **Duplicate folder** offer rename and move but no delete. Such
a folder may be full, and a trash can beside it invites taking its contents along
when the fix is the name.

## Drag and drop

The drag payload is read on drop, not on dragover, because Chromium exposes only
the *type* list during a drag. The type (`text/x-bookmark-id`) is enough to know
the drag is ours and to show the drop target; whether the drop is legal is
settled once the id arrives. `canDropInto` refuses a folder dropped into its own
descendant — the browser reports that as an opaque error rather than refusing it
usefully — and refuses a move that would change nothing.
