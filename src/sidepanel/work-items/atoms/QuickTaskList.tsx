import { useRef, type FormEvent } from 'react';
import clsx from 'clsx';
import type { WorkItem } from '@/types';
import { Link } from '@/sidepanel/Link';
import classes from './QuickTaskList.module.css';
import { isFinishedState } from './quickTaskSorting';

interface QuickTaskListProps {
  items: WorkItem[];
  pinnedIds: number[];
  parentId: number | null;
  title: string;
  isActionDisabled: boolean;
  linkExternal: boolean;
  onTitleChange: (value: string) => void;
  onCreate: () => Promise<void>;
  onTogglePin: (id: number) => Promise<void>;
}

export function QuickTaskList({
  items,
  pinnedIds,
  parentId,
  title,
  isActionDisabled,
  linkExternal,
  onTitleChange,
  onCreate,
  onTogglePin
}: QuickTaskListProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pinned = new Set(pinnedIds);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onCreate();
    // Keep focus so several tasks can be typed in a row.
    globalThis.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  return (
    <>
      <form
        className={classes.form}
        onSubmit={(event) => {
          void onSubmit(event);
        }}
      >
        <div className={classes.inputRow}>
          <input
            className={classes.textInput}
            ref={inputRef}
            type="text"
            value={title}
            placeholder="Type a quick task and press Enter"
            disabled={isActionDisabled || parentId === null}
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <button
            type="submit"
            className={classes.submitButton}
            disabled={isActionDisabled || parentId === null || !title.trim()}
            title="Create quick task"
          >
            +
          </button>
        </div>
        <div className={classes.hint}>
          {parentId === null
            ? 'Set a quick-task parent work item id in Settings to enable this.'
            : `Created in progress under #${parentId} and assigned to you.`}
        </div>
      </form>

      {items.length === 0 ? (
        <p>No quick tasks.</p>
      ) : (
        <div className={classes.list} role="list">
          {items.map((item) => {
            const isPinned = pinned.has(item.id);
            return (
              <div
                key={item.id}
                role="listitem"
                className={clsx(
                  classes.row,
                  isFinishedState(item.state) && classes.rowFinished
                )}
              >
                <button
                  type="button"
                  className={clsx(classes.pin, isPinned && classes.pinActive)}
                  aria-pressed={isPinned}
                  title={isPinned ? 'Unpin' : 'Pin to top'}
                  onClick={() => {
                    void onTogglePin(item.id);
                  }}
                >
                  {isPinned ? '★' : '☆'}
                </button>
                <Link
                  className={classes.id}
                  href={item.url}
                  external={linkExternal}
                >
                  {item.id}
                </Link>
                <span className={classes.title} title={item.title}>
                  {item.title}
                </span>
                <span className={classes.state} title={item.state}>
                  {item.state}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
