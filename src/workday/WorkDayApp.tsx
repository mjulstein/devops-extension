import { useEffect, useState } from 'react';
import type { WorkItem } from '@/types';
import { Button } from '@/sidepanel/atoms/Button';
import { applyTheme, loadLastKnownTheme } from '@/sidepanel/theme';
import { WorkItemRow } from '@/sidepanel/work-items/atoms/WorkItemRow';
import { QuickTaskList } from '@/sidepanel/work-items/atoms/QuickTaskList';
import {
  dayKey,
  dayStart,
  findLooseEnds,
  summariseDay,
  type DayItemSummary
} from '@/devops/workDay';
import type { ActivityItem } from '@/devops/workDayApi';
import { useWorkDay } from './useWorkDay';
import { useQuickTasksFeed } from './useQuickTasksFeed';
import { useReplies } from './useReplies';
import type { Reply } from '@/devops/replies';
import classes from './WorkDayApp.module.css';

function toWorkItem(item: ActivityItem): WorkItem {
  return {
    id: item.id,
    workItemType: item.workItemType,
    title: item.title,
    state: item.state,
    assignedTo: item.assignedTo,
    parentId: item.parentId,
    parent: null,
    closedDate: null,
    lastChangedDate: null,
    url: item.url
  };
}

function formatDay(day: string): string {
  return dayStart(day).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  });
}

function timeAgo(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 60) {
    return `${String(minutes)} min ago`;
  }
  const hours = Math.round(minutes / 60);
  return hours < 48
    ? `${String(hours)} h ago`
    : `${String(Math.round(hours / 24))} days ago`;
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/**
 * The last-working-day dashboard.
 *
 * Left: what the user did on the day. Right: what that day left open, and the
 * quick tasks underneath. The day is found, not picked: the last one with at
 * least N of the user's changes, so weekends and vacations fall away by
 * themselves, and Back / Forward correct the pick when it is not the one meant.
 */
export function WorkDayApp() {
  const workDay = useWorkDay();
  const quick = useQuickTasksFeed(workDay.settings);
  const replies = useReplies(workDay.settings);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    void loadLastKnownTheme().then(applyTheme);
  }, []);

  const summaries: DayItemSummary[] = workDay.span
    ? summariseDay(workDay.changes, workDay.span)
    : [];
  // The heading names the joined days only as far as there were changes:
  // quiet days with none would only stretch it.
  const lastChangeDay = summaries.reduce<string | null>((latest, summary) => {
    const day = dayKey(new Date(summary.lastAt));
    return latest === null || day > latest ? day : latest;
  }, null);
  const changeCount = summaries.reduce((sum, s) => sum + s.changeCount, 0);
  const looseEnds = findLooseEnds(
    summaries,
    [...workDay.items.values()],
    workDay.identity
  );

  const assignedTo = workDay.settings?.assignedTo.trim() ?? '';
  const subject = assignedTo === '' ? 'you' : assignedTo;

  const rowFor = (id: number, note?: string, followUp = false) => {
    const item = workDay.items.get(id);
    if (!item) {
      return null;
    }
    return (
      <div key={id} className={classes.entry}>
        <WorkItemRow
          item={toWorkItem(item)}
          showState
          showParentDetails={false}
          linkExternal
        />
        {note && <span className={classes.note}>{note}</span>}
        {followUp && quick.parentId !== null && (
          <Button
            className={classes.followUp}
            onClick={() => {
              quick.draftFollowUp(item.title, item.url);
            }}
            description="Draft a quick task to follow this up. It is not linked to the item; edit the title and create it below"
          >
            ✎ Follow up
          </Button>
        )}
      </div>
    );
  };

  const replyRow = (reply: Reply) => (
    <div
      key={reply.key}
      role="listitem"
      className={reply.mention ? classes.mentionRow : classes.replyRow}
    >
      <a href={reply.url} target="_blank" rel="noreferrer">
        {reply.title}
      </a>
      <span className={classes.note}>
        {reply.lastAuthor} · {timeAgo(reply.lastAt, now)}
        {reply.excerpt && ` · ${reply.excerpt}`}
      </span>
      <span className={classes.replyActions}>
        {quick.parentId !== null && (
          <Button
            onClick={() => {
              quick.draftFollowUp(reply.title, reply.url);
            }}
            description="Draft a quick task to follow this up. It is not linked to the thread; edit the title and create it below"
          >
            ✎ Follow up
          </Button>
        )}
        <Button
          onClick={() => {
            void replies.markSeen(reply);
          }}
          description="Hide this thread until somebody writes in it again"
        >
          ✓ Seen
        </Button>
      </span>
    </div>
  );

  return (
    <div className={classes.wrap}>
      <header className={classes.header}>
        <Button
          onClick={workDay.back}
          disabled={workDay.isLoading}
          description="The working day before this one"
        >
          ← Back
        </Button>
        <div className={classes.heading}>
          {workDay.day ? (
            <>
              <h1 className={classes.title}>
                {lastChangeDay && lastChangeDay !== workDay.day
                  ? `${formatDay(workDay.day)} – ${formatDay(lastChangeDay)}`
                  : formatDay(workDay.day)}
              </h1>
              <p className={classes.context}>
                {plural(changeCount, 'change', 'changes')} across{' '}
                {plural(summaries.length, 'item', 'items')} by {subject} · a
                working day has at least {workDay.minChanges} changes
              </p>
            </>
          ) : workDay.emptyWindow ? (
            <>
              <h1 className={classes.title}>No working day found</h1>
              <p className={classes.context}>
                No day with at least {workDay.minChanges} changes by {subject}{' '}
                between {formatDay(workDay.emptyWindow.from)} and{' '}
                {formatDay(workDay.emptyWindow.to)}. Back searches the 15 days
                before.
              </p>
            </>
          ) : (
            <h1 className={classes.title}>
              {workDay.isLoading ? 'Looking for your last working day…' : ''}
            </h1>
          )}
          {workDay.error && <p className={classes.error}>{workDay.error}</p>}
        </div>
        <Button
          onClick={workDay.forward}
          disabled={workDay.isLoading || !workDay.canGoForward}
          description="The working day after this one"
        >
          Forward →
        </Button>
      </header>

      <main className={classes.columns}>
        <section className={classes.column} aria-label="What was done">
          <h2 className={classes.sectionTitle}>What was done</h2>
          <div role="list">
            {summaries.map((summary) =>
              rowFor(summary.id, summary.actions.join(', '))
            )}
          </div>
        </section>

        <div className={classes.right}>
          <section className={classes.column} aria-label="Loose ends">
            <h2 className={classes.sectionTitle}>Loose ends</h2>
            {replies.error && <p className={classes.error}>{replies.error}</p>}
            {replies.isLoading && (
              <p className={classes.note}>Reading recent threads…</p>
            )}
            <LooseEndGroup title="Mentioned you, no answer yet">
              {replies.mentions.map(replyRow)}
            </LooseEndGroup>
            <LooseEndGroup title="Replied to you (last 14 days)">
              {replies.replies.map(replyRow)}
            </LooseEndGroup>
            <LooseEndGroup title="Still in the state you moved them to">
              {looseEnds.stillInState.map((id) => rowFor(id, undefined, true))}
            </LooseEndGroup>
            <LooseEndGroup title="Created with no parent">
              {looseEnds.createdWithoutParent.map((id) =>
                rowFor(id, undefined, true)
              )}
            </LooseEndGroup>
            <LooseEndGroup title="Handed over">
              {looseEnds.handedOver.map((id) =>
                rowFor(id, workDay.items.get(id)?.assignedTo, true)
              )}
            </LooseEndGroup>
          </section>

          <section className={classes.column} aria-label="Quick tasks">
            <h2 className={classes.sectionTitle}>Quick tasks</h2>
            {quick.error && <p className={classes.error}>{quick.error}</p>}
            {quick.noteUrl && (
              <p className={classes.draftLink}>
                Description will link to {quick.noteUrl}{' '}
                <Button
                  onClick={quick.dropNoteUrl}
                  description="Create the task without this link"
                >
                  ✕
                </Button>
              </p>
            )}
            <QuickTaskList
              items={quick.items}
              pinnedIds={quick.pinnedIds}
              parentId={quick.parentId}
              title={quick.title}
              isActionDisabled={quick.isBusy}
              linkExternal
              onTitleChange={quick.setTitle}
              onCreate={quick.onCreate}
              // There is no page behind this window to name a task after, so
              // an empty title creates nothing rather than "Last working day".
              onCreateFromPage={() => Promise.resolve()}
              canCreateFromPage={quick.parentId !== null}
              onTogglePin={quick.onTogglePin}
              archiveId={quick.archiveId}
              onArchive={quick.onArchive}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

function LooseEndGroup({
  title,
  children
}: {
  title: string;
  children: React.ReactNode[];
}) {
  const rows = children.filter(Boolean);
  if (rows.length === 0) {
    return null;
  }
  return (
    <div className={classes.group}>
      <h3 className={classes.groupTitle}>{title}</h3>
      <div role="list">{rows}</div>
    </div>
  );
}
