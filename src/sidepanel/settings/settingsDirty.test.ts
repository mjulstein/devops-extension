import type { Settings } from '@/types';
import {
  describeUnsavedSettings,
  findChangedSettingsTabs
} from './settingsDirty';

const SAVED: Settings = {
  organization: 'my-org',
  project: 'my-project',
  assignedTo: '',
  todoStates: ['To Do', 'In Progress'],
  quickTaskParentId: '9000',
  quickTaskArchiveId: '9100',
  bookmarkFolderName: 'my-favorites'
};

describe('findChangedSettingsTabs', () => {
  it('reports nothing when the draft matches what was saved', () => {
    expect(findChangedSettingsTabs({ ...SAVED }, SAVED)).toEqual([]);
  });

  it('attributes each field to the tab that owns it', () => {
    expect(
      findChangedSettingsTabs({ ...SAVED, project: 'other' }, SAVED)
    ).toEqual(['connection']);
    expect(
      findChangedSettingsTabs({ ...SAVED, quickTaskArchiveId: '1' }, SAVED)
    ).toEqual(['quick']);
    expect(
      findChangedSettingsTabs({ ...SAVED, bookmarkFolderName: 'x' }, SAVED)
    ).toEqual(['favorites']);
  });

  it('reports several tabs in strip order', () => {
    expect(
      findChangedSettingsTabs(
        { ...SAVED, bookmarkFolderName: 'x', organization: 'y' },
        SAVED
      )
    ).toEqual(['connection', 'favorites']);
  });

  it('notices a changed TODO states list', () => {
    expect(
      findChangedSettingsTabs({ ...SAVED, todoStates: ['To Do'] }, SAVED)
    ).toEqual(['connection']);
    expect(
      findChangedSettingsTabs(
        { ...SAVED, todoStates: ['In Progress', 'To Do'] },
        SAVED
      )
    ).toEqual(['connection']);
  });

  it('treats an identical TODO list as unchanged despite being a new array', () => {
    expect(
      findChangedSettingsTabs(
        { ...SAVED, todoStates: ['To Do', 'In Progress'] },
        SAVED
      )
    ).toEqual([]);
  });

  it('ignores the Token and Tools tabs, which own no settings', () => {
    const changed = findChangedSettingsTabs(
      { ...SAVED, organization: 'z' },
      SAVED
    );
    expect(changed).not.toContain('token');
    expect(changed).not.toContain('maintenance');
  });
});

describe('describeUnsavedSettings', () => {
  it('says so when there is nothing to save', () => {
    expect(describeUnsavedSettings([])).toBe('No unsaved settings changes.');
  });

  it('names the one tab with changes', () => {
    expect(describeUnsavedSettings(['quick'])).toBe(
      'Save unsaved changes on Quick.'
    );
  });

  it('lists several tabs readably', () => {
    expect(describeUnsavedSettings(['connection', 'favorites'])).toBe(
      'Save unsaved changes on Project and Favorites.'
    );
    expect(describeUnsavedSettings(['connection', 'quick', 'favorites'])).toBe(
      'Save unsaved changes on Project, Quick and Favorites.'
    );
  });
});
