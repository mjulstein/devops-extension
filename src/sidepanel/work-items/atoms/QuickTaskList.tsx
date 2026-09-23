import { useRef, type FormEvent } from 'react';
import clsx from 'clsx';
import type { WorkItem } from '@/types';
import { Link } from '@/sidepanel/Link';
import {
  abbreviateTaskState,
  getTaskStateTone,
  type TaskStateTone
} from '@/sidepanel/taskStateDisplay';
import classes from './QuickTaskList.module.css';
import { Button } from '@/sidepanel/atoms/Button';
import { isFinishedState } from './quickTaskSorting';

const stateToneClassNames: Record<TaskStateTone, string> = {
  todo: classes.stateTodo,
  'in-progress': classes.stateInProgress,
  done: classes.stateDone,
  blocked: classes.stateBlocked,
  unknown: classes.stateUnknown
};

interface QuickTaskListProps {
  items: WorkItem[];
  pinnedIds: number[];
  parentId: number | null;
  title: string;
  isActionDisabled: boolean;
  linkExternal: boolean;
  onTitleChange: (value: string) => void;
  /** Creates a task titled from the input. */
  onCreate: () => Promise<void>;
  /** Creates a task titled from the current page, used when the input is empty. */
  onCreateFromPage: () => Promise<void>;
  /** False when no quick-task parent is configured, which disables creating. */
  canCreateFromPage: boolean;
  onTogglePin: (id: number) => Promise<void>;
  /** null when no archive work item is configured, which hides the action. */
  archiveId: number | null;
  onArchive: (id: number) => Promise<void>;
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
  onCreateFromPage,
  canCreateFromPage,
  onTogglePin,
  archiveId,
  onArchive
}: QuickTaskListProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pinned = new Set(pinnedIds);
  const typedTitle = title.trim();
  // One button, two jobs: an empty input means "capture the page I am on",
  // anything typed means "use what I typed".
  const createsFromPage = typedTitle.length === 0;
  const canCreate =
    !isActionDisabled &&
    parentId !== null &&
    (createsFromPage ? canCreateFromPage : true);

  async function create() {
    if (!canCreate) {
      return;
    }

    await (createsFromPage ? onCreateFromPage() : onCreate());
    // Keep focus so several tasks can be typed in a row.
    globalThis.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await create();
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
            placeholder="Type a quick task, or leave empty for this page"
            disabled={isActionDisabled || parentId === null}
            onChange={(event) => onTitleChange(event.target.value)}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!canCreate}
            title={
              parentId === null
                ? 'Set a quick-task parent work item id in Settings to enable this'
                : createsFromPage
                  ? 'Create an in-progress task from the current page'
                  : `Create an in-progress task titled "${typedTitle}"`
            }
          >
            {createsFromPage ? '+ page' : '+'}
          </Button>
        </div>
        <div className={classes.hint}>
          {parentId === null
            ? 'Set a quick-task parent work item id in Settings to enable this.'
            : `Created in progress under #${parentId} and assigned to you. An empty box captures the current page.`}
        </div>
      </form>

      {items.length === 0 ? (
        <p>No quick tasks.</p>
      ) : (
        <div className={classes.list} role="list">
          {items.map((item) => {
            const isPinned = pinned.has(item.id);
            const isFinished = isFinishedState(item.state);
            return (
              <div
                key={item.id}
                role="listitem"
                className={clsx(classes.row, isFinished && classes.rowFinished)}
              >
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
                {/* Two letters and a colour carry the state in a fraction of
                    the width; the full name stays in the tooltip. */}
                <span
                  className={clsx(
                    classes.state,
                    stateToneClassNames[getTaskStateTone(item.state)]
                  )}
                  title={item.state}
                  aria-label={item.state}
                >
                  {abbreviateTaskState(item.state)}
                </span>
                {/* Only finished tasks can be archived — an open one still
                    belongs in the list. */}
                {isFinished && archiveId !== null ? (
                  <Button
                    variant="quiet"
                    size="compact"
                    icon="⇥"
                    description={`Archive under #${archiveId}`}
                    className={classes.rowAction}
                    onClick={() => {
                      void onArchive(item.id);
                    }}
                  />
                ) : (
                  <span aria-hidden="true" />
                )}
                {/* Pinning is a rare, deliberate act, so the control stays out
                    of the way until the row is hovered. An active pin is always
                    shown: it is the only sign the row was pinned. */}
                <Button
                  variant="quiet"
                  size="compact"
                  icon="📌"
                  description={isPinned ? 'Unpin' : 'Pin to top'}
                  isPressed={isPinned}
                  className={clsx(
                    classes.rowAction,
                    classes.pin,
                    isPinned && classes.pinActive
                  )}
                  onClick={() => {
                    void onTogglePin(item.id);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
