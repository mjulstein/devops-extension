import { useCallback, useState } from 'react';
import clsx from 'clsx';
import { Button } from '../sidepanel/atoms/Button';
import type { BookmarkNode } from './bookmarksModel';
import classes from './FolderTree.module.css';

export const BOOKMARK_DRAG_TYPE = 'text/x-bookmark-id';

interface FolderTreeProps {
  nodes: BookmarkNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Answers whether this drop is legal, so the row can refuse it visibly. */
  canDrop: (dragId: string, targetId: string) => boolean;
  onDrop: (dragId: string, targetId: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  /** Called only where flattening is possible; the row hides the button otherwise. */
  onFlatten: (id: string) => void;
  canFlatten: (id: string) => boolean;
  /**
   * Which folders are closed. Held by the page rather than here because
   * revealing a folder has to open whatever is closed above it, and that request
   * arrives from the lists below.
   */
  collapsed: Set<string>;
  onToggleCollapsed: (id: string) => void;
}

function subfolders(node: BookmarkNode): BookmarkNode[] {
  return (node.children ?? []).filter((child) => child.url === undefined);
}

/**
 * The folder side of the organiser: every folder, nested, each one a drop target.
 *
 * Drag data is read on drop rather than on dragover, because the drag payload is
 * not readable during dragover in Chromium — only the type list is. The type is
 * ours alone, so its presence is enough to know the drag is one of ours; whether
 * *this* drop is legal is settled when the id finally arrives.
 */
export function FolderTree({
  nodes,
  selectedId,
  onSelect,
  canDrop,
  onDrop,
  onRename,
  onDelete,
  onFlatten,
  canFlatten,
  collapsed,
  onToggleCollapsed
}: FolderTreeProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  // Brings a folder selected from somewhere else into view. A reveal that
  // leaves you looking at the wrong part of a long tree has not revealed
  // anything.
  const scrollSelectedIntoView = useCallback((node: HTMLDivElement | null) => {
    node?.scrollIntoView({ block: 'nearest' });
  }, []);

  function commitRename(id: string): void {
    const title = draftTitle.trim();
    if (title) {
      onRename(id, title);
    }
    setEditingId(null);
  }

  function renderNodes(list: BookmarkNode[], depth: number) {
    return list
      .filter((node) => node.url === undefined)
      .map((node) => {
        const children = subfolders(node);
        const isCollapsed = collapsed.has(node.id);
        const childCount = (node.children ?? []).length;

        return (
          <li key={node.id}>
            <div
              ref={node.id === selectedId ? scrollSelectedIntoView : undefined}
              className={clsx(
                classes.folder,
                node.id === selectedId && classes.selected,
                node.id === dragOverId && classes.dropTarget
              )}
              style={{ paddingInlineStart: `${6 + depth * 14}px` }}
              draggable={editingId !== node.id}
              onDragStart={(event) => {
                event.dataTransfer.setData(BOOKMARK_DRAG_TYPE, node.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(event) => {
                if (!event.dataTransfer.types.includes(BOOKMARK_DRAG_TYPE)) {
                  return;
                }
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOverId(node.id);
              }}
              onDragLeave={() => {
                setDragOverId((current) =>
                  current === node.id ? null : current
                );
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOverId(null);
                const dragId = event.dataTransfer.getData(BOOKMARK_DRAG_TYPE);
                if (dragId && canDrop(dragId, node.id)) {
                  onDrop(dragId, node.id);
                }
              }}
            >
              {children.length > 0 ? (
                <Button
                  size="compact"
                  variant="quiet"
                  className={classes.twisty}
                  icon={isCollapsed ? '+' : '−'}
                  isExpanded={!isCollapsed}
                  description={
                    isCollapsed
                      ? `Expand ${node.title}`
                      : `Collapse ${node.title}`
                  }
                  onClick={() => {
                    onToggleCollapsed(node.id);
                  }}
                />
              ) : (
                // Holds the column open so titles line up whether or not a
                // folder has anything to collapse.
                <span
                  className={classes.twistyPlaceholder}
                  aria-hidden="true"
                />
              )}

              {editingId === node.id ? (
                <input
                  className={classes.renameInput}
                  value={draftTitle}
                  autoFocus
                  aria-label="Folder name"
                  onChange={(event) => {
                    setDraftTitle(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitRename(node.id);
                    }
                    if (event.key === 'Escape') {
                      setEditingId(null);
                    }
                  }}
                  onBlur={() => {
                    commitRename(node.id);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={classes.folderButton}
                  onClick={() => {
                    onSelect(node.id);
                  }}
                >
                  <span aria-hidden="true">📁</span>
                  <span className={classes.folderTitle}>
                    {node.title || '(untitled)'}
                  </span>
                  <span className={classes.count}>{childCount}</span>
                </button>
              )}

              {editingId === node.id ? null : (
                <span className={classes.actions}>
                  <Button
                    size="compact"
                    variant="quiet"
                    icon="✏️"
                    description={`Rename ${node.title}`}
                    onClick={() => {
                      setDraftTitle(node.title);
                      setEditingId(node.id);
                    }}
                  />
                  {canFlatten(node.id) ? (
                    <Button
                      size="compact"
                      variant="quiet"
                      icon="⇤"
                      description={`Flatten ${node.title}: move what is inside it up one level and remove it`}
                      onClick={() => {
                        onFlatten(node.id);
                      }}
                    />
                  ) : null}
                  <Button
                    size="compact"
                    variant="quiet"
                    icon="🗑"
                    description={`Delete ${node.title}`}
                    onClick={() => {
                      // A folder deletes everything under it, and unlike a
                      // bookmark that is not something you can put back from
                      // the address bar. An empty one has nothing to lose, so
                      // it goes without the interruption.
                      if (
                        childCount > 0 &&
                        !window.confirm(
                          `Delete “${node.title}” and the ${childCount} item${childCount === 1 ? '' : 's'} inside it?`
                        )
                      ) {
                        return;
                      }
                      onDelete(node.id);
                    }}
                  />
                </span>
              )}
            </div>
            {children.length > 0 && !isCollapsed ? (
              <ul className={classes.list}>
                {renderNodes(node.children ?? [], depth + 1)}
              </ul>
            ) : null}
          </li>
        );
      });
  }

  return (
    <nav aria-label="Bookmark folders">
      <ul className={classes.list}>{renderNodes(nodes, 0)}</ul>
    </nav>
  );
}
