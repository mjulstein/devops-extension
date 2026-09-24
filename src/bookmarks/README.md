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
| [`FolderTree.tsx`](./FolderTree.tsx) | Every folder, nested, each one a drop target. |
| [`BookmarkRow.tsx`](./BookmarkRow.tsx) | One bookmark row, the same in the organiser and in every issue list. |
| [`IssuesPanel.tsx`](./IssuesPanel.tsx) | The **Duplicate name** / **Duplicate path** / **Empty folders** tabs, each with its own filter. |

## Two kinds of duplicate

**Duplicate name** is bookmarks sharing a title, wherever they live: a list of
identical rows cannot be used, and which one to keep is a judgement only the
reader can make.

**Duplicate path** compares addresses with their search params and hash removed,
and only reports a group whose members sit in *different* folders. Two copies
inside one folder are already side by side in the organiser; the case worth
surfacing is the same page filed twice where neither copy is visible from the
other.

## Drag and drop

The drag payload is read on drop, not on dragover, because Chromium exposes only
the *type* list during a drag. The type (`text/x-bookmark-id`) is enough to know
the drag is ours and to show the drop target; whether the drop is legal is
settled once the id arrives. `canDropInto` refuses a folder dropped into its own
descendant — the browser reports that as an opaque error rather than refusing it
usefully — and refuses a move that would change nothing.
