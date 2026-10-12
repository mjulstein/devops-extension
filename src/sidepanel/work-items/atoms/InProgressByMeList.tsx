import clsx from 'clsx';
import { Button } from '@/sidepanel/atoms/Button';
import {
  describeInProgressItem,
  type InProgressByMe,
  type InProgressItem
} from '@/devops/inProgressByMe';
import classes from './OrphansList.module.css';

interface InProgressByMeListProps {
  data: InProgressByMe | null;
  isLoading: boolean;
  error: string | null;
  state: string;
  onStateChange: (state: string) => void;
  onRefresh: () => void;
  linkExternal: boolean;
}

/**
 * Two readings of "in progress by me", side by side.
 *
 * What is assigned to you is yours to finish. What you moved into the state but
 * is assigned to somebody else is a handover — yours to them, or theirs to
 * themselves — and the assignee's name is the only thing that tells the two
 * apart, so it is on every row of the second list and none of the first.
 *
 * The state is typed rather than chosen from a list: it is called different
 * things in different processes, and this view is not the place to go and find
 * out which.
 */
export function InProgressByMeList({
  data,
  isLoading,
  error,
  state,
  onStateChange,
  onRefresh,
  linkExternal
}: InProgressByMeListProps) {
  return (
    <div className={clsx(isLoading && classes.refreshing)}>
      <div className={classes.toolbar}>
        <input
          className={classes.parentInput}
          value={state}
          placeholder="State"
          aria-label="The state name that means in progress"
          onChange={(event) => {
            onStateChange(event.target.value);
          }}
        />
        <Button
          size="compact"
          disabled={state.trim() === ''}
          title={
            state.trim() === ''
              ? 'Type the state name that means in progress'
              : undefined
          }
          onClick={onRefresh}
        >
          Find
        </Button>
      </div>

      {error !== null && <p className={classes.error}>{error}</p>}

      {data === null ? (
        <p>Name the state and press Find.</p>
      ) : (
        <>
          <Section
            title={`Assigned to me, ${state}`}
            items={data.assigned}
            withAssignee={false}
            linkExternal={linkExternal}
          />
          <Section
            title={`Moved to ${state} by me, not assigned to me`}
            items={data.startedForOthers}
            withAssignee
            linkExternal={linkExternal}
          />
        </>
      )}
    </div>
  );
}

function Section({
  title,
  items,
  withAssignee,
  linkExternal
}: {
  title: string;
  items: InProgressItem[];
  withAssignee: boolean;
  linkExternal: boolean;
}) {
  return (
    <section>
      <h3 className={classes.sectionHeading}>{title}</h3>
      {items.length === 0 ? (
        <p className={classes.status}>Nothing here.</p>
      ) : (
        <ul className={classes.list}>
          {items.map((item) => (
            <li key={item.id} className={classes.row}>
              <a
                className={classes.link}
                href={item.url}
                target={linkExternal ? '_blank' : undefined}
                rel={linkExternal ? 'noreferrer' : undefined}
              >
                <span className={classes.title}>
                  {describeInProgressItem(item, withAssignee)}
                </span>
                <span className={classes.meta}>
                  #{item.id} · {item.project}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
