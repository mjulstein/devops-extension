import {
  areClosedDateRangesEqual,
  createDefaultClosedDateRange,
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
});
