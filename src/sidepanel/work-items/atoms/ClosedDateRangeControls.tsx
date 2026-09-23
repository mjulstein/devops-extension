import clsx from 'clsx';
import type { ClosedDateRange } from '@/types';
import classes from './ClosedDateRangeControls.module.css';
import { Button } from '@/sidepanel/atoms/Button';

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
        <Button
          size="compact"
          description="Back to the default range: today through seven days ago"
          onClick={() => {
            void onResetClosedDateRange();
          }}
          disabled={isActionDisabled}
        >
          Reset
        </Button>

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
            <Button
              size="compact"
              title="Using today. Click to choose a custom date."
              disabled={isActionDisabled}
              onClick={onEnableCustomClosedEndDate}
            >
              today
            </Button>
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
