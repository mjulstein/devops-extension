import { useState } from 'react';
import clsx from 'clsx';
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
  onDrop
}: FolderTreeProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function renderNodes(list: BookmarkNode[], depth: number) {
    return list
      .filter((node) => node.url === undefined)
      .map((node) => (
        <li key={node.id}>
          <div
            className={clsx(
              classes.folder,
              node.id === selectedId && classes.selected,
              node.id === dragOverId && classes.dropTarget
            )}
            style={{ paddingInlineStart: `${6 + depth * 14}px` }}
            draggable
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
              <span className={classes.count}>
                {(node.children ?? []).length}
              </span>
            </button>
          </div>
          {node.children?.some((child) => child.url === undefined) ? (
            <ul className={classes.list}>
              {renderNodes(node.children, depth + 1)}
            </ul>
          ) : null}
        </li>
      ));
  }

  return (
    <nav aria-label="Bookmark folders">
      <ul className={classes.list}>{renderNodes(nodes, 0)}</ul>
    </nav>
  );
}
