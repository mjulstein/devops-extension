import {
  describeStaleTabs,
  selectStaleTabs,
  STALE_TAB_DAYS,
  type StaleTabCandidate
} from './staleTabs';

const DAY = 24 * 60 * 60 * 1000;
const now = 1_000 * DAY;

function tab(
  id: number,
  daysOld: number,
  extra: Partial<StaleTabCandidate> = {}
): StaleTabCandidate {
  return { id, lastAccessed: now - daysOld * DAY, ...extra };
}

describe('selectStaleTabs', () => {
  it('takes only the tabs past the age, oldest first', () => {
    expect(selectStaleTabs([tab(1, 30), tab(2, 1), tab(3, 40)], now)).toEqual([
      3, 1
    ]);
  });

  it('leaves a tab exactly at the boundary alone', () => {
    expect(selectStaleTabs([tab(1, STALE_TAB_DAYS)], now)).toEqual([]);
    expect(selectStaleTabs([tab(1, STALE_TAB_DAYS + 1)], now)).toEqual([1]);
  });

  it('keeps a pinned tab, because pinning says keep this', () => {
    expect(selectStaleTabs([tab(1, 90, { pinned: true })], now)).toEqual([]);
  });

  it('keeps the active tab and anything making a noise', () => {
    expect(
      selectStaleTabs(
        [tab(1, 90, { active: true }), tab(2, 90, { audible: true })],
        now
      )
    ).toEqual([]);
  });

  it('keeps a tab whose age the browser does not report', () => {
    // Not knowing how old it is is not the same as it being old.
    expect(selectStaleTabs([{ id: 1 }], now)).toEqual([]);
  });

  it('ignores a tab with no id to close', () => {
    expect(selectStaleTabs([{ lastAccessed: now - 90 * DAY }], now)).toEqual(
      []
    );
  });

  it('honours a different age when one is given', () => {
    expect(selectStaleTabs([tab(1, 10)], now, 7)).toEqual([1]);
  });
});

describe('describeStaleTabs', () => {
  it('says how many and how old the oldest is', () => {
    const tabs = [tab(1, 30), tab(2, 40)];
    expect(describeStaleTabs(tabs, [1, 2], now)).toBe(
      `Close 2 tabs untouched for ${STALE_TAB_DAYS} days or more? The oldest is 40 days old.`
    );
  });

  it('says plainly when there is nothing to close', () => {
    expect(describeStaleTabs([], [], now)).toBe(
      `No tabs have gone ${STALE_TAB_DAYS} days untouched.`
    );
  });
});
