import {
  applyClosedDateRangeOverrides,
  areClosedDateRangesEqual,
  createClosedDateRangeOverrides,
  createDefaultClosedDateRange,
  getTodayDateInputValue,
  isTodayDateInputValue,
  isValidClosedDateRange
} from './workItemsDateRange';

describe('workItemsDateRange.ts', () => {
  it('creates the default closed date range from today back seven days', () => {
    const range = createDefaultClosedDateRange(new Date(2026, 2, 17));

    expect(range).toEqual({
      start: '2026-03-10',
      end: '2026-03-17'
    });
  });

  it('validates ranges only when both dates are valid and ordered', () => {
    expect(
      isValidClosedDateRange({ start: '2026-03-10', end: '2026-03-17' })
    ).toBe(true);
    expect(
      isValidClosedDateRange({ start: '2026-03-18', end: '2026-03-17' })
    ).toBe(false);
    expect(
      isValidClosedDateRange({ start: '2026-02-31', end: '2026-03-17' })
    ).toBe(false);
  });

  it('compares ranges by their date values', () => {
    expect(
      areClosedDateRangesEqual(
        { start: '2026-03-10', end: '2026-03-17' },
        { start: '2026-03-10', end: '2026-03-17' }
      )
    ).toBe(true);
    expect(
      areClosedDateRangesEqual(
        { start: '2026-03-10', end: '2026-03-17' },
        { start: '2026-03-11', end: '2026-03-17' }
      )
    ).toBe(false);
  });

  it('identifies today date input values', () => {
    expect(isTodayDateInputValue('2026-03-17', new Date(2026, 2, 17))).toBe(
      true
    );
    expect(isTodayDateInputValue('2026-03-16', new Date(2026, 2, 17))).toBe(
      false
    );
    expect(getTodayDateInputValue(new Date(2026, 2, 17))).toBe('2026-03-17');
  });

  it('stores only explicit overrides from the default range', () => {
    expect(
      createClosedDateRangeOverrides(
        { start: '2026-03-10', end: '2026-03-17' },
        new Date(2026, 2, 17)
      )
    ).toBeNull();

    expect(
      createClosedDateRangeOverrides(
        { start: '2026-03-09', end: '2026-03-17' },
        new Date(2026, 2, 17)
      )
    ).toEqual({ start: '2026-03-09' });

    expect(
      createClosedDateRangeOverrides(
        { start: '2026-03-10', end: '2026-03-16' },
        new Date(2026, 2, 17)
      )
    ).toEqual({ end: '2026-03-16' });
  });

  it('applies stored overrides on top of the default range', () => {
    expect(
      applyClosedDateRangeOverrides(undefined, new Date(2026, 2, 17))
    ).toEqual({
      start: '2026-03-10',
      end: '2026-03-17'
    });

    expect(
      applyClosedDateRangeOverrides(
        { start: '2026-03-08' },
        new Date(2026, 2, 17)
      )
    ).toEqual({
      start: '2026-03-08',
      end: '2026-03-17'
    });
  });
});
