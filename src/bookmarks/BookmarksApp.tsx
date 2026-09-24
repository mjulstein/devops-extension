import { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Button } from '../sidepanel/atoms/Button';
import { applyTheme, loadLastKnownTheme } from '../sidepanel/theme';
import { BookmarkRow } from './BookmarkRow';
import { BOOKMARK_DRAG_TYPE, FolderTree } from './FolderTree';
import { IssuesPanel } from './IssuesPanel';
import {
  ancestorIdsOf,
  canDropInto,
  planFlatten,
  collectFolders,
  filterEntries,
  findNode,
  flattenBookmarks,
  type BookmarkEntry,
  type BookmarkNode
} from './bookmarksModel';
import {
  applyFlatten,
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
  // What the issue lists describe. It follows a folder chosen in the tree, but
  // not one reached by clicking a duplicate: narrowing the lists to the folder
  // you just jumped from would drop the very copy you were comparing it with.
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // Bulk selection, shared by both halves of the page: rows are checked
  // wherever they are found, and acted on together from one bar.
  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set());
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

  // A checked bookmark can be deleted from the browser's own manager or by the
  // bulk action itself, and a selection counting rows that no longer exist would
  // report a number nothing can act on.
  const checked = useMemo(() => {
    const live = new Set(entries.map((entry) => entry.id));
    return new Set([...checkedIds].filter((id) => live.has(id)));
  }, [checkedIds, entries]);

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }, []);

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

  const bulkMove = useCallback(
    (parentId: string) => {
      const ids = [...checked];
      setCheckedIds(new Set());
      act(async () => {
        for (const id of ids) {
          await moveInto(id, parentId);
        }
      });
    },
    [act, checked]
  );

  const bulkDelete = useCallback(() => {
    const ids = [...checked];
    if (
      ids.length === 0 ||
      !window.confirm(
        `Delete ${ids.length} bookmark${ids.length === 1 ? '' : 's'}?`
      )
    ) {
      return;
    }
    setCheckedIds(new Set());
    act(async () => {
      for (const id of ids) {
        await removeNode(id, false);
      }
    });
  }, [act, checked]);

  const selected = selectedId ? findNode(tree, selectedId) : null;
  const scope = scopeId ? findNode(tree, scopeId) : null;

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }, []);

  /**
   * Shows a folder in the tree: opens whatever is closed above it and selects
   * it, so its contents are on screen beside the list that sent you there.
   */
  const revealFolder = useCallback(
    (folderId: string) => {
      const ancestors = ancestorIdsOf(tree, folderId);
      setCollapsed((current) => {
        const next = new Set(current);
        for (const id of ancestors) {
          next.delete(id);
        }
        return next;
      });
      setSelectedId(folderId);
    },
    [tree]
  );

  // Choosing a folder in the tree narrows the lists below to that subtree. A
  // duplicate is only worth reading about where you are working: the whole-tree
  // list is long enough that the two copies you just made go unnoticed in it.
  const scopedTree = scope ? [scope] : tree;

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

      {checked.size > 0 ? (
        <div
          className={classes.bulkBar}
          role="group"
          aria-label="Selected bookmarks"
        >
          <strong>{checked.size} selected</strong>
          <select
            className={classes.bulkSelect}
            aria-label="Move the selected bookmarks to a folder"
            value=""
            onChange={(event) => {
              if (event.target.value) {
                bulkMove(event.target.value);
              }
            }}
          >
            <option value="">Move to…</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.path
                  ? `${folder.path} / ${folder.title}`
                  : folder.title}
              </option>
            ))}
          </select>
          <Button icon="🗑" size="compact" onClick={bulkDelete}>
            Delete
          </Button>
          <Button
            size="compact"
            variant="quiet"
            onClick={() => {
              setCheckedIds(new Set());
            }}
          >
            Clear
          </Button>
        </div>
      ) : null}

      <div className={classes.split}>
        <div className={classes.organiser}>
          <aside className={classes.tree}>
            <div className={classes.treeHeader}>
              <span>Folders</span>
              <Button
                size="compact"
                variant="quiet"
                disabled={!selectedId}
                description="Clear the selection and describe the whole tree again"
                onClick={() => {
                  setSelectedId(null);
                  setScopeId(null);
                }}
              >
                All
              </Button>
            </div>
            <FolderTree
              nodes={tree}
              selectedId={selectedId}
              onSelect={(id) => {
                setSelectedId(id);
                setScopeId(id);
              }}
              canDrop={(dragId, targetId) =>
                canDropInto(tree, dragId, targetId)
              }
              onDrop={handleMove}
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
              canFlatten={(id) => planFlatten(tree, id) !== null}
              onFlatten={(id) => {
                const plan = planFlatten(tree, id);
                if (!plan) {
                  return;
                }
                if (id === selectedId) {
                  setSelectedId(null);
                }
                if (id === scopeId) {
                  setScopeId(null);
                }
                act(() => applyFlatten(plan));
              }}
              onRename={(id, title) => {
                act(() => updateNode(id, { title }));
              }}
              onDelete={(id) => {
                // The selection cannot survive its own folder, and leaving it
                // pointing at a deleted id shows an empty contents pane with no
                // way to tell why.
                if (id === selectedId) {
                  setSelectedId(null);
                }
                if (id === scopeId) {
                  setScopeId(null);
                }
                act(() => removeNode(id, true));
              }}
            />
          </aside>

          <section
            className={clsx(
              classes.contents,
              search.trim() && classes.searching
            )}
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
              if (
                selectedId &&
                dragId &&
                canDropInto(tree, dragId, selectedId)
              ) {
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
                  checked={checked.has(entry.id)}
                  onToggleChecked={toggleChecked}
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
          tree={scopedTree}
          folders={folders}
          scopeLabel={scope ? scope.title || '(untitled)' : null}
          onReveal={revealFolder}
          checkedIds={checked}
          onToggleChecked={toggleChecked}
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
    </div>
  );
}
