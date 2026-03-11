import { setActiveWorkItemParent } from './setActiveWorkItemParent';

const queryMock = vi.fn();
const sendMessageMock = vi.fn();

describe('setActiveWorkItemParent.test.ts', () => {
  beforeEach(() => {
    queryMock.mockReset();
    sendMessageMock.mockReset();

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        tabs: {
          query: queryMock,
          sendMessage: sendMessageMock
        }
      }
    });
  });

  it('sends SET_ACTIVE_WORK_ITEM_PARENT with parent id', async () => {
    const response = { ok: true, result: null };

    queryMock.mockResolvedValue([{ id: 15 }]);
    sendMessageMock.mockResolvedValue(response);

    await expect(setActiveWorkItemParent(999)).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenCalledWith(15, {
      type: 'SET_ACTIVE_WORK_ITEM_PARENT',
      payload: { parentId: 999 }
    });
  });
});
