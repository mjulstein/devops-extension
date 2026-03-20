import clsx from 'clsx';
import { useId } from 'react';
import type { ParentSuggestionItem } from '@/types';
import { Link } from '../Link';
import { PinIcon } from './PinIcon';
import classes from './RecentFeaturesCard.module.css';

interface RecentFeatureSuggestionView extends ParentSuggestionItem {
  isPinned: boolean;
}

interface RecentFeaturesCardProps {
  items: RecentFeatureSuggestionView[];
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onSetFeatureParent: (featureId: number) => Promise<void>;
  onTogglePinSuggestedParent: (
    group: 'parentable' | 'feature',
    parentId: number,
    isPinned: boolean
  ) => void;
  linkExternal: boolean;
}

export function RecentFeaturesCard({
  items,
  isCollapsed,
  onToggleCollapsed,
  onSetFeatureParent,
  onTogglePinSuggestedParent,
  linkExternal
}: RecentFeaturesCardProps) {
  const sectionId = useId();

  return (
    <section className={clsx(classes.card, classes.recentFeaturesCard)}>
      <div className={classes.cardHeader}>
        <div className={classes.title}>Recent features</div>
        <button
          type="button"
          className={classes.sectionToggle}
          aria-label={
            isCollapsed ? 'Expand recent features' : 'Collapse recent features'
          }
          aria-expanded={!isCollapsed}
          aria-controls={sectionId}
          title={
            isCollapsed ? 'Expand recent features' : 'Collapse recent features'
          }
          onClick={onToggleCollapsed}
        >
          <span aria-hidden="true">{isCollapsed ? '▸' : '▾'}</span>
        </button>
      </div>

      {!isCollapsed ? (
        <div id={sectionId} className={classes.parentSuggestionList}>
          {items.length ? (
            items.map((item) => (
              <div
                key={`feature-${item.id}`}
                className={classes.parentSuggestionRow}
              >
                <Link
                  href={item.url}
                  external={linkExternal}
                  className={classes.parentSuggestionLink}
                  title={item.title}
                >
                  #{item.id} [{item.workItemType}] - {item.title}
                </Link>
                <button
                  type="button"
                  className={classes.parentSuggestionAction}
                  onClick={() => {
                    void onSetFeatureParent(item.id);
                  }}
                >
                  set feature
                </button>
                <button
                  type="button"
                  className={clsx(
                    classes.parentSuggestionAction,
                    classes.parentSuggestionPin,
                    classes.pinButton,
                    item.isPinned
                      ? classes.pinButtonPinned
                      : classes.pinButtonUnpinned
                  )}
                  aria-label={
                    item.isPinned
                      ? `Unpin feature #${item.id}`
                      : `Pin feature #${item.id}`
                  }
                  title={
                    item.isPinned
                      ? `Unpin feature #${item.id}`
                      : `Pin feature #${item.id}`
                  }
                  onClick={() =>
                    onTogglePinSuggestedParent(
                      'feature',
                      item.id,
                      !item.isPinned
                    )
                  }
                >
                  <PinIcon
                    isPinned={item.isPinned}
                    className={classes.pinIcon}
                  />
                </button>
              </div>
            ))
          ) : (
            <div className={classes.emptyText}>
              No recent features yet. Visit a feature work item to populate this
              list.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
