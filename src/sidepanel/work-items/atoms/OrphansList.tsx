import { useState } from 'react';
import clsx from 'clsx';
import { Button } from '@/sidepanel/atoms/Button';
import type { OrphanCandidate } from '@/devops/orphanWorkItems';
import classes from './OrphansList.module.css';

interface OrphansListProps {
  items: OrphanCandidate[] | null;
  isLoading: boolean;
  error: string | null;
  /** Reports what happened to the last bulk action. */
  status: string | null;
  onParent: (ids: number[], parentId: number) => void;
  linkExternal: boolean;
}

/**
 * Work items with no parent, and a way to put several under one.
 *
 * The parent is typed as a number rather than picked from a list: a feature id
 * is what you have in front of you when you come to do this, and fetching every
 * feature to choose from would be slower than the typing it saves.
 *
 * What may go where is checked before anything is sent, and partially: a
 * selection of Tasks and Bugs is an ordinary thing to tick before noticing they
 * cannot share a parent, so the ones that fit are moved and the rest are
 * explained rather than the whole batch refused.
 */
export function OrphansList({
  items,
  isLoading,
  error,
  status,
  onParent,
  linkExternal
}: OrphansListProps) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [parentText, setParentText] = useState('');

  const parentId = Number(parentText.trim());
  const hasParentId = Number.isFinite(parentId) && parentId > 0;

  function toggle(id: number): void {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  if (items === null) {
    return <p>Click Orphans to find work items with no parent.</p>;
  }

  if (error !== null) {
    return <p className={classes.error}>{error}</p>;
  }

  const ids = items.map((item) => item.id);
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));

  return (
    <div className={clsx(isLoading && classes.refreshing)}>
      {status !== null && <p className={classes.status}>{status}</p>}

      {items.length === 0 ? (
        <p>Nothing of yours is missing a parent.</p>
      ) : (
        <>
          <div className={classes.toolbar}>
            <label className={classes.selectAll}>
              <input
                type="checkbox"
                checked={allSelected}
                aria-label="Select every work item listed"
                onChange={() => {
                  setSelected(allSelected ? new Set() : new Set(ids));
                }}
              />
              {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
            </label>

            <input
              className={classes.parentInput}
              value={parentText}
              inputMode="numeric"
              placeholder="Parent id"
              aria-label="Id of the work item to parent them under"
              onChange={(event) => {
                setParentText(event.target.value);
              }}
            />
            <Button
              variant="primary"
              size="compact"
              disabled={selected.size === 0 || !hasParentId}
              title={
                selected.size === 0
                  ? 'Tick the work items to move first'
                  : hasParentId
                    ? undefined
                    : 'Type the id of the parent work item'
              }
              onClick={() => {
                onParent([...selected], parentId);
                setSelected(new Set());
              }}
            >
              Parent
            </Button>
          </div>

          <ul className={classes.list}>
            {items.map((item) => (
              <li key={item.id} className={classes.row}>
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  aria-label={`Select ${item.workItemType} ${item.id}`}
                  onChange={() => {
                    toggle(item.id);
                  }}
                />
                <a
                  className={classes.link}
                  href={item.url}
                  target={linkExternal ? '_blank' : undefined}
                  rel={linkExternal ? 'noreferrer' : undefined}
                >
                  <span className={classes.title}>{item.title}</span>
                  <span className={classes.meta}>
                    #{item.id} · {item.workItemType} · {item.state}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
