import { useState } from 'react';
import clsx from 'clsx';
import classes from './FavoritesEditor.module.css';
import type { StarredPage } from '../starredPages';
import {
  commitDraft,
  createDraft,
  editRow,
  isDraftDirty,
  moveRow,
  removeRow,
  type DraftRow
} from './favoritesDraft';

interface FavoritesEditorProps {
  pages: StarredPage[];
  onSave: (pages: StarredPage[]) => Promise<void>;
}

/**
 * Every starred page in one editable list, behind an accordion so it does not
 * dominate the settings tab.
 *
 * Edits are held in a draft and applied only on Save. That is not merely tidier:
 * persisting on every keystroke also trimmed the label as it was typed, which
 * made it impossible to enter a space anywhere but before another character.
 */
export function FavoritesEditor({ pages, onSave }: FavoritesEditorProps) {
  const [rows, setRows] = useState<DraftRow[]>(() => createDraft(pages));
  const [baseline, setBaseline] = useState<StarredPage[]>(pages);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = isDraftDirty(rows, baseline);

  // Adopt changes that came from elsewhere — starring a page, another window —
  // but never over a half-typed edit. Adjusting state during render is React's
  // documented way to react to changed props without an effect.
  if (baseline !== pages && !isDirty) {
    setBaseline(pages);
    setRows(createDraft(pages));
  }

  function edit(key: string, patch: Partial<StarredPage>) {
    setRows((current) => editRow(current, key, patch));
  }

  function move(index: number, direction: -1 | 1) {
    setRows((current) => moveRow(current, index, direction));
  }

  async function save() {
    setIsSaving(true);
    try {
      const cleaned = commitDraft(rows);
      await onSave(cleaned);
      setBaseline(cleaned);
      setRows(createDraft(cleaned));
    } finally {
      setIsSaving(false);
    }
  }

  function cancel() {
    setRows(createDraft(baseline));
  }

  return (
    <details className={classes.accordion}>
      <summary className={classes.summary}>
        Favorites
        <span className={classes.count}>{pages.length}</span>
        {isDirty ? <span className={classes.dirty}>unsaved</span> : null}
      </summary>

      {rows.length === 0 ? (
        <p className={classes.empty}>
          No favorites yet. Open an Azure DevOps page and use the ☆ button.
        </p>
      ) : (
        <div className={classes.section}>
          {rows.map((row, index) => (
            <div className={classes.row} key={row.key}>
              <div className={classes.fields}>
                <input
                  className={classes.textInput}
                  type="text"
                  value={row.page.label}
                  aria-label={`Favorite name ${index + 1}`}
                  onChange={(event) =>
                    edit(row.key, { label: event.target.value })
                  }
                />
                <input
                  className={clsx(classes.textInput, classes.urlInput)}
                  type="text"
                  value={row.page.url}
                  aria-label={`Favorite address ${index + 1}`}
                  onChange={(event) =>
                    edit(row.key, { url: event.target.value })
                  }
                />
              </div>
              <div className={classes.actions}>
                <button
                  type="button"
                  className={classes.iconButton}
                  title="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={classes.iconButton}
                  title="Move down"
                  disabled={index === rows.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={clsx(classes.iconButton, classes.remove)}
                  title="Remove"
                  onClick={() =>
                    setRows((current) => removeRow(current, row.key))
                  }
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={classes.buttonRow}>
        <button
          type="button"
          className={classes.button}
          disabled={!isDirty || isSaving}
          onClick={() => {
            void save();
          }}
        >
          {isSaving ? 'Saving…' : 'Save favorites'}
        </button>
        <button
          type="button"
          className={classes.button}
          disabled={!isDirty || isSaving}
          onClick={cancel}
        >
          Cancel
        </button>
      </div>
    </details>
  );
}
