import type { Settings } from '@/types';

export type RuntimeMessage =
  | {
      type: 'FETCH_WORK_ITEMS';
      payload: Settings;
    }
  | {
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT';
    }
  | {
      type: 'CREATE_CHILD_TASK';
      payload: {
        title: string;
      };
    }
  | {
      type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT';
    };

