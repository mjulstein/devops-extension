import clsx from 'clsx';
import { useId } from 'react';
import type { ParentSuggestionItem } from '@/types';
import { ParentSuggestionRow } from './atoms/ParentSuggestionRow';
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
              <ParentSuggestionRow
                key={`feature-${item.id}`}
                id={item.id}
                title={item.title}
                url={item.url}
                workItemType={item.workItemType}
                isPinned={item.isPinned}
                actionLabel="set feature"
                onAction={() => {
                  void onSetFeatureParent(item.id);
                }}
                onTogglePin={() => {
                  onTogglePinSuggestedParent(
                    'feature',
                    item.id,
                    !item.isPinned
                  );
                }}
                linkExternal={linkExternal}
                pinLabel={`Pin feature #${item.id}`}
                unpinLabel={`Unpin feature #${item.id}`}
              />
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
