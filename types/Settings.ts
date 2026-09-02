export interface Settings {
  organization: string;
  project: string;
  assignedTo: string;
  todoStates: string[];
  /**
   * Work item that quick tasks are parented to — a personal catch-all for small
   * jobs that do not belong to real planned work. Stored as text so the field
   * can be empty; empty disables the quick-task button.
   */
  quickTaskParentId: string;
  /**
   * Work item that finished quick tasks are moved under, to keep the Quick list
   * to what is still live. Empty hides the archive action.
   */
  quickTaskArchiveId: string;
}

