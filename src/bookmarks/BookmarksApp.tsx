import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from '../sidepanel/atoms/Button';
import { applyTheme, loadLastKnownTheme } from '../sidepanel/theme';
import { BookmarkRow } from './BookmarkRow';
import { BOOKMARK_DRAG_TYPE, FolderTree } from './FolderTree';
import { IssuesPanel } from './IssuesPanel';
import {
  canDropInto,
  collectFolders,
  filterEntries,
  findNode,
  flattenBookmarks,
  type BookmarkEntry,
  type BookmarkNode
} from './bookmarksModel';
import {
  createFolder,
  moveInto,
  readTree,
  removeNode,
  subscribeToBookmarkChanges,
  updateNode
} from './bookmarksApi';
import classes from './BookmarksApp.module.css';

/**
 * The bookmark manager page.
 *
 * It exists because the browser's own manager is the slowest part of keeping
 * bookmarks usable: it has no view of what is duplicated and no way to act on it
 * where it is found. The top half is for reorganising by hand, the bottom half
 * is the three lists of things that want fixing — and every row in both halves
 * carries the same edit, delete and move actions, so a problem is fixed where it
 * is seen rather than hunted down again somewhere else.
 */
export function BookmarksApp() {
  const [tree, setTree] = useState<BookmarkNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    readTree().then(setTree, (cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToBookmarkChanges(refresh);
  }, [refresh]);

  useEffect(() => {
    void loadLastKnownTheme().then(applyTheme);
  }, []);

  const folders = useMemo(() => collectFolders(tree), [tree]);
  const entries = useMemo(() => flattenBookmarks(tree), [tree]);

  // The selection picks the folder; the search ignores it, because looking for a
  // bookmark you cannot place is exactly when you do not know its folder.
  const listed: BookmarkEntry[] = useMemo(() => {
    if (search.trim()) {
      return filterEntries(entries, search);
    }
    if (!selectedId) {
      return [];
    }
    const node = findNode(tree, selectedId);
    return (node?.children ?? [])
      .filter((child) => child.url)
      .map((child) => ({
        id: child.id,
        title: child.title,
        url: child.url ?? '',
        parentId: selectedId,
        folderPath: ''
      }));
  }, [entries, search, selectedId, tree]);

  const act = useCallback(
    (run: () => Promise<void>) => {
      setError(null);
      run().then(refresh, (cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      });
    },
    [refresh]
  );

  const handleMove = useCallback(
    (id: string, parentId: string) => {
      act(() => moveInto(id, parentId));
    },
    [act]
  );

  const selected = selectedId ? findNode(tree, selectedId) : null;

  return (
    <div className={classes.page}>
      <header className={classes.header}>
        <h1 className={classes.heading}>Bookmarks</h1>
        <input
          className={classes.search}
          value={search}
          placeholder="Search every bookmark"
          aria-label="Search every bookmark"
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
        <Button
          icon="＋"
          description="New folder inside the selected folder"
          disabled={!selectedId}
          onClick={() => {
            if (selectedId) {
              act(() => createFolder(selectedId, 'New folder'));
            }
          }}
        />
      </header>

      {error ? <p className={classes.error}>{error}</p> : null}

      <div className={classes.organiser}>
        <aside className={classes.tree}>
          <FolderTree
            nodes={tree}
            selectedId={selectedId}
            onSelect={setSelectedId}
            canDrop={(dragId, targetId) => canDropInto(tree, dragId, targetId)}
            onDrop={handleMove}
          />
        </aside>

        <section
          className={clsx(classes.contents, search.trim() && classes.searching)}
          aria-label="Folder contents"
          onDragOver={(event) => {
            if (
              selectedId &&
              event.dataTransfer.types.includes(BOOKMARK_DRAG_TYPE)
            ) {
              event.preventDefault();
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            const dragId = event.dataTransfer.getData(BOOKMARK_DRAG_TYPE);
            if (selectedId && dragId && canDropInto(tree, dragId, selectedId)) {
              handleMove(dragId, selectedId);
            }
          }}
        >
          <h2 className={classes.contentsHeading}>
            {search.trim()
              ? `Matches for “${search.trim()}”`
              : (selected?.title ?? 'Pick a folder')}
          </h2>
          <ul className={classes.list}>
            {listed.map((entry) => (
              <BookmarkRow
                key={entry.id}
                entry={entry}
                folders={folders}
                showFolder={Boolean(search.trim())}
                draggable
                onEdit={(id, changes) => {
                  act(() => updateNode(id, changes));
                }}
                onDelete={(id) => {
                  act(() => removeNode(id, false));
                }}
                onMove={handleMove}
              />
            ))}
          </ul>
          {listed.length === 0 ? (
            <p className={classes.empty}>
              {search.trim()
                ? 'Nothing matches.'
                : 'Drag bookmarks and folders onto a folder to file them.'}
            </p>
          ) : null}
        </section>
      </div>

      <IssuesPanel
        tree={tree}
        folders={folders}
        onEdit={(id, changes) => {
          act(() => updateNode(id, changes));
        }}
        onDelete={(id) => {
          act(() => removeNode(id, false));
        }}
        onDeleteFolder={(id) => {
          act(() => removeNode(id, true));
        }}
        onRenameFolder={(id, title) => {
          act(() => updateNode(id, { title }));
        }}
        onMove={handleMove}
      />
    </div>
  );
}
