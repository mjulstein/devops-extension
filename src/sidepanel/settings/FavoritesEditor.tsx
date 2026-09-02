import clsx from 'clsx';
import classes from './FavoritesEditor.module.css';
import type { StarredPage } from '../starredPages';

interface FavoritesEditorProps {
  pages: StarredPage[];
  onUpdate: (
    originalUrl: string,
    next: { label: string; url: string }
  ) => Promise<void>;
  onRemove: (url: string) => Promise<void>;
  onMove: (url: string, direction: -1 | 1) => Promise<void>;
}

/**
 * Every starred page in one editable list. The menu in the header is for
 * opening them quickly; this is where they get renamed, reordered and removed —
 * the order here is the order the menu shows.
 */
export function FavoritesEditor({
  pages,
  onUpdate,
  onRemove,
  onMove
}: FavoritesEditorProps) {
  if (pages.length === 0) {
    return (
      <p className={classes.empty}>
        No favorites yet. Open an Azure DevOps page and use ☆ Starred → Star
        this page.
      </p>
    );
  }

  return (
    <div className={classes.section}>
      {pages.map((page, index) => (
        <div className={classes.row} key={page.url}>
          <div className={classes.fields}>
            <input
              className={classes.textInput}
              type="text"
              value={page.label}
              aria-label={`Favorite name for ${page.url}`}
              onChange={(event) => {
                void onUpdate(page.url, {
                  label: event.target.value,
                  url: page.url
                });
              }}
            />
            <input
              className={clsx(classes.textInput, classes.urlInput)}
              type="text"
              value={page.url}
              aria-label={`Favorite address for ${page.label}`}
              onChange={(event) => {
                void onUpdate(page.url, {
                  label: page.label,
                  url: event.target.value
                });
              }}
            />
          </div>
          <div className={classes.actions}>
            <button
              type="button"
              className={classes.iconButton}
              title="Move up"
              disabled={index === 0}
              onClick={() => {
                void onMove(page.url, -1);
              }}
            >
              ↑
            </button>
            <button
              type="button"
              className={classes.iconButton}
              title="Move down"
              disabled={index === pages.length - 1}
              onClick={() => {
                void onMove(page.url, 1);
              }}
            >
              ↓
            </button>
            <button
              type="button"
              className={clsx(classes.iconButton, classes.remove)}
              title={`Remove ${page.label}`}
              onClick={() => {
                void onRemove(page.url);
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
