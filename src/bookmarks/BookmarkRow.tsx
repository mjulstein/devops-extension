import { useState } from 'react';
import clsx from 'clsx';
import { Button } from '../sidepanel/atoms/Button';
import { getFavoriteIconUrl } from '../sidepanel/favoriteIcon';
import type { BookmarkEntry, FolderEntry } from './bookmarksModel';
import classes from './BookmarkRow.module.css';

interface BookmarkRowProps {
  entry: BookmarkEntry;
  /** Offered in the move control; omitted where moving makes no sense. */
  folders?: FolderEntry[];
  showFolder?: boolean;
  draggable?: boolean;
  /**
   * Shows the row's folder in the tree instead of following the link. Given in
   * the issue lists, where the question a row raises is *where does this live*
   * — following the link would leave the manager entirely. A modified click
   * still opens the bookmark, which is the browser's own convention.
   */
  onReveal?: (folderId: string) => void;
  /** Present where the row takes part in a bulk selection. */
  checked?: boolean;
  onToggleChecked?: (id: string) => void;
  onEdit: (id: string, changes: { title: string; url: string }) => void;
  onDelete: (id: string) => void;
  onMove?: (id: string, parentId: string) => void;
}

/**
 * One bookmark, wherever it is shown.
 *
 * The same row serves the folder contents and every duplicate section, because
 * the actions a bookmark offers do not change with the reason it is on screen:
 * seeing it highlighted as a duplicate and being able to fix it there is the
 * point of highlighting it at all.
 */
export function BookmarkRow({
  entry,
  folders,
  showFolder = false,
  draggable = false,
  onReveal,
  checked,
  onToggleChecked,
  onEdit,
  onDelete,
  onMove
}: BookmarkRowProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entry.title);
  const [url, setUrl] = useState(entry.url);

  // The fields are filled when the edit opens rather than kept in step with the
  // entry: a change arriving from another window mid-edit would otherwise
  // overwrite what is being typed.
  function beginEditing(): void {
    setTitle(entry.title);
    setUrl(entry.url);
    setEditing(true);
  }

  const icon = getFavoriteIconUrl(entry.url);

  if (editing) {
    return (
      <li className={clsx(classes.row, classes.editing)}>
        <div className={classes.editFields}>
          <input
            className={classes.input}
            value={title}
            aria-label="Bookmark title"
            onChange={(event) => {
              setTitle(event.target.value);
            }}
          />
          <input
            className={classes.input}
            value={url}
            aria-label="Bookmark address"
            onChange={(event) => {
              setUrl(event.target.value);
            }}
          />
        </div>
        <div className={classes.actions}>
          <Button
            variant="primary"
            size="compact"
            onClick={() => {
              onEdit(entry.id, { title: title.trim(), url: url.trim() });
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button
            size="compact"
            onClick={() => {
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={classes.row}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/x-bookmark-id', entry.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
    >
      {onToggleChecked ? (
        <input
          type="checkbox"
          className={classes.checkbox}
          checked={checked ?? false}
          aria-label={`Select ${entry.title}`}
          onChange={() => {
            onToggleChecked(entry.id);
          }}
        />
      ) : null}
      {icon ? (
        <img className={classes.icon} src={icon} alt="" />
      ) : (
        <span className={classes.icon} aria-hidden="true" />
      )}
      <a
        className={classes.link}
        href={entry.url}
        title={onReveal ? "Show this bookmark's folder in the tree" : entry.url}
        onClick={(event) => {
          if (!onReveal || event.ctrlKey || event.metaKey || event.shiftKey) {
            return;
          }
          event.preventDefault();
          onReveal(entry.parentId);
        }}
      >
        <span className={classes.title}>{entry.title || entry.url}</span>
        <span className={classes.url}>
          {showFolder && entry.folderPath ? `${entry.folderPath} — ` : ''}
          {entry.url}
        </span>
      </a>
      <div className={classes.actions}>
        {folders && onMove ? (
          <select
            className={classes.moveSelect}
            aria-label={`Move ${entry.title} to a folder`}
            title="Move to folder"
            value=""
            onChange={(event) => {
              if (event.target.value) {
                onMove(entry.id, event.target.value);
              }
            }}
          >
            <option value="">Move to…</option>
            {folders
              .filter((folder) => folder.id !== entry.parentId)
              .map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.path
                    ? `${folder.path} / ${folder.title}`
                    : folder.title}
                </option>
              ))}
          </select>
        ) : null}
        <Button
          size="compact"
          variant="quiet"
          icon="✏️"
          description={`Edit ${entry.title}`}
          onClick={beginEditing}
        />
        <Button
          size="compact"
          variant="quiet"
          icon="🗑"
          description={`Delete ${entry.title}`}
          onClick={() => {
            onDelete(entry.id);
          }}
        />
      </div>
    </li>
  );
}
