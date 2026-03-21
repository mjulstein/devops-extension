import clsx from 'clsx';
import type { ClosedDateRange } from '@/types';
import classes from './ClosedDateRangeControls.module.css';

interface ClosedDateRangeControlsProps {
  closedDateRange: ClosedDateRange;
  isClosedEndTodayShortcut: boolean;
  isActionDisabled: boolean;
  onClosedDateRangeChange: (
    key: keyof ClosedDateRange,
    value: string
  ) => Promise<void>;
  onEnableCustomClosedEndDate: () => void;
  onResetClosedDateRange: () => Promise<void>;
}

export function ClosedDateRangeControls({
  closedDateRange,
  isClosedEndTodayShortcut,
  isActionDisabled,
  onClosedDateRangeChange,
  onEnableCustomClosedEndDate,
  onResetClosedDateRange
}: ClosedDateRangeControlsProps) {
  return (
    <div className={clsx(classes.controls, classes.compact)}>
      <div className={classes.dateRange}>
        <button
          type="button"
          className={clsx(classes.button, classes.resetButton)}
          onClick={() => {
            void onResetClosedDateRange();
          }}
          disabled={isActionDisabled}
        >
          Reset
        </button>

        <div className={classes.dateField}>
          <input
            className={classes.dateInput}
            type="date"
            value={closedDateRange.start}
            aria-label="Closed from"
            title="Closed from"
            disabled={isActionDisabled}
            onChange={(event) => {
              void onClosedDateRangeChange('start', event.target.value);
            }}
          />
        </div>

        <span className={classes.dateSeparator} aria-hidden="true">
          -
        </span>

        <div className={classes.dateField}>
          {isClosedEndTodayShortcut ? (
            <button
              type="button"
              className={clsx(classes.button, classes.todayButton)}
              title="Using today. Click to choose a custom date."
              disabled={isActionDisabled}
              onClick={onEnableCustomClosedEndDate}
            >
              today
            </button>
          ) : (
            <input
              className={classes.dateInput}
              type="date"
              value={closedDateRange.end}
              aria-label="Closed through"
              title="Closed through"
              disabled={isActionDisabled}
              onChange={(event) => {
                void onClosedDateRangeChange('end', event.target.value);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
