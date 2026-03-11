import { getActiveTabId } from './getActiveTabId';

const queryMock = vi.fn();

describe('getActiveTabId.test.ts', () => {
  beforeEach(() => {
    queryMock.mockReset();

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        tabs: {
          query: queryMock
        }
      }
    });
  });

  it('returns the active tab id when present', async () => {
    queryMock.mockResolvedValue([{ id: 42 }]);

    await expect(getActiveTabId()).resolves.toBe(42);
    expect(queryMock).toHaveBeenCalledWith({
      active: true,
      currentWindow: true
    });
  });

  it('throws when no active tab id is available', async () => {
    queryMock.mockResolvedValue([{}]);

    await expect(getActiveTabId()).rejects.toThrow('No active tab found.');
  });
});
