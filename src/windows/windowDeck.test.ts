import {
  describeWindow,
  moveIdTo,
  orderWindows,
  readWindows
} from './windowDeck';

function raw(id: number, titles: string[], extra: object = {}) {
  return {
    id,
    type: 'normal',
    tabs: titles.map((title, index) => ({
      id: id * 100 + index,
      title,
      url: `https://a.test/${title}`,
      active: index === 0
    })),
    ...extra
  };
}

describe('readWindows', () => {
  it('names a window after what is in front of you in it', () => {
    expect(readWindows([raw(1, ['Front', 'Behind'])])[0].title).toBe('Front');
  });

  it('counts a single-tab window as that tab, and keeps it', () => {
    // A window holding one tab is a place you were working like any other.
    const [window] = readWindows([raw(2, ['Only'])]);
    expect(window.single).toBe(true);
    expect(window.title).toBe('Only');
  });

  it('leaves out the popups, which the deck itself is one of', () => {
    expect(readWindows([{ id: 3, type: 'popup', tabs: [] }])).toEqual([]);
  });

  it('falls back to the address when a tab has no title', () => {
    const windows = readWindows([
      { id: 4, type: 'normal', tabs: [{ id: 1, url: 'https://a.test/x' }] }
    ]);
    expect(windows[0].title).toBe('https://a.test/x');
  });
});

describe('orderWindows', () => {
  const windows = readWindows([
    raw(1, ['One']),
    raw(2, ['Two']),
    raw(3, ['Three'])
  ]);

  it('draws them in the order it was given', () => {
    expect(orderWindows(windows, [3, 1, 2], []).map((w) => w.id)).toEqual([
      3, 1, 2
    ]);
  });

  it('floats the pinned ones to the top, in pin order', () => {
    expect(orderWindows(windows, [3, 2, 1], [2]).map((w) => w.id)).toEqual([
      2, 3, 1
    ]);
  });

  it('puts a window it has never seen at the end', () => {
    // Opened just now: at the end, not somewhere in the middle.
    expect(orderWindows(windows, [3], []).map((w) => w.id)).toEqual([3, 1, 2]);
  });

  it('ignores a pin for a window that has closed', () => {
    expect(orderWindows(windows, [], [99]).map((w) => w.id)).toEqual([1, 2, 3]);
  });
});

describe('moveIdTo', () => {
  it('moves an id into the gap before another', () => {
    expect(moveIdTo([1, 2, 3], 3, 0)).toEqual([3, 1, 2]);
  });

  it('moves an id to the last gap', () => {
    expect(moveIdTo([1, 2, 3], 1, 3)).toEqual([2, 3, 1]);
  });

  it('changes nothing when dropped into its own gaps', () => {
    expect(moveIdTo([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
    expect(moveIdTo([1, 2, 3], 2, 2)).toEqual([1, 2, 3]);
  });

  it('ignores an id that is not there', () => {
    const ids = [1, 2, 3];
    expect(moveIdTo(ids, 9, 0)).toBe(ids);
  });
});

describe('describeWindow', () => {
  it('says what closing a window would take with it', () => {
    const [many] = readWindows([raw(1, ['Front', 'A', 'B'])]);
    expect(describeWindow(many)).toBe('Front and 2 more');
  });

  it('says only the name when that is all there is', () => {
    const [one] = readWindows([raw(2, ['Alone'])]);
    expect(describeWindow(one)).toBe('Alone');
  });
});
