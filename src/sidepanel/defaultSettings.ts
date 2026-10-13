import type { Settings } from '@/types';

export const defaultSettings: Settings = {
  organization: '',
  project: '',
  assignedTo: '',
  todoStates: [],
  quickTaskParentId: '',
  quickTaskArchiveId: '',
  staleTabDays: '',
  tabGroups: [],
  bookmarkFolderName: '',
  themeOverrides: { light: {}, dark: {} }
};
