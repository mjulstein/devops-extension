import { Button } from '@/sidepanel/atoms/Button';
import { describeTabAge, type AdoTabGroup } from '@/sidepanel/adoTabs';
import classes from './AdoTabsList.module.css';

interface AdoTabsListProps {
  groups: AdoTabGroup[];
  onClose: (id: number) => void;
  onSwitchTo: (id: number, windowId: number | null) => void;
}

/**
 * The Azure DevOps tabs you have open, to close or go back to.
 *
 * The close sits on the left, before the name, because closing is what this
 * list is mostly for and reaching past the title to find an x at the end of a
 * ragged row is the slower half of doing it. The name is the control that
 * switches: the thing you read is the thing you press.
 */
export function AdoTabsList({ groups, onClose, onSwitchTo }: AdoTabsListProps) {
  if (groups.length === 0) {
    return <p className={classes.empty}>No Azure DevOps tabs are open.</p>;
  }

  return (
    <div className={classes.groups}>
      {groups.map((group) => (
        <section key={group.section}>
          <h4 className={classes.heading}>
            {group.label}
            <span className={classes.count}>{group.tabs.length}</span>
          </h4>
          <ul className={classes.list}>
            {group.tabs.map((tab) => (
              <li key={tab.id} className={classes.row}>
                <Button
                  size="compact"
                  variant="quiet"
                  icon="✕"
                  description={`Close ${tab.title}`}
                  onClick={() => {
                    onClose(tab.id);
                  }}
                />
                <button
                  type="button"
                  className={classes.name}
                  title={tab.url}
                  onClick={() => {
                    onSwitchTo(tab.id, tab.windowId);
                  }}
                >
                  <span className={classes.title}>{tab.title}</span>
                  <span className={classes.meta}>
                    {describeTabAge(tab)} · {tab.path}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
