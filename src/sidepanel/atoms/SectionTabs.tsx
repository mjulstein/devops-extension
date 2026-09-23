import type { ReactNode } from 'react';
import clsx from 'clsx';
import classes from './SectionTabs.module.css';

// One tab strip for every tabbed region in the panel. Shared so the Settings
// regions look and behave exactly like the work-items lists rather than being a
// second, slightly different set of tabs.

export interface SectionTabDescriptor<TabId extends string> {
  id: TabId;
  label: string;
  /** Shown beside the label when the tab has a countable list behind it. */
  count?: number | null;
  title?: string;
}

interface SectionTabsProps<TabId extends string> {
  tabs: SectionTabDescriptor<TabId>[];
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  label: string;
  /**
   * Control pinned to the right of the strip, for an action that belongs to the
   * whole region rather than one tab. It sits outside the scrolling tab list so
   * it cannot scroll out of reach on a narrow panel.
   */
  actions?: ReactNode;
}

export function SectionTabs<TabId extends string>({
  tabs,
  activeTab,
  onSelectTab,
  label,
  actions
}: SectionTabsProps<TabId>) {
  const strip = (
    <div className={classes.tabs} role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === activeTab}
          title={tab.title}
          className={clsx(
            classes.tab,
            tab.id === activeTab && classes.tabActive
          )}
          onClick={() => {
            onSelectTab(tab.id);
          }}
        >
          {tab.label}
          {tab.count === null || tab.count === undefined ? null : (
            <span className={classes.count}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );

  if (!actions) {
    return strip;
  }

  return (
    <div className={classes.row}>
      <div className={classes.stripWrap}>{strip}</div>
      <div className={classes.actions}>{actions}</div>
    </div>
  );
}
