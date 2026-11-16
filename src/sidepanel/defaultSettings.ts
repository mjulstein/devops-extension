import type { Settings } from '@/types';

export const defaultSettings: Settings = {
  organization: '',
  project: '',
  assignedTo: '',
  todoStates: [],
  quickTaskParentId: '',
  quickTaskArchiveId: '',
  staleTabDays: '',
  bookmarkFolderName: '',
  workDayMinChanges: '',
  themeOverrides: { light: {}, dark: {} }
};
