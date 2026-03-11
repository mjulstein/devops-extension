export type ParentSuggestionGroup = 'parentable' | 'feature';

export interface ParentSuggestionItem {
  id: number;
  title: string;
  workItemType: string;
  url: string;
  lastVisitedAt: number;
}

export interface ParentSuggestionStore {
  recentByGroup: Record<ParentSuggestionGroup, ParentSuggestionItem[]>;
  pinnedIdsByGroup: Record<ParentSuggestionGroup, number[]>;
}

