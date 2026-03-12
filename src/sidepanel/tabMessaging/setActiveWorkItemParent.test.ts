import { setActiveWorkItemParent } from './setActiveWorkItemParent';

const sendMessageMock = vi.fn();

describe('setActiveWorkItemParent.test.ts', () => {
  beforeEach(() => {
    sendMessageMock.mockReset();

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage: sendMessageMock
        }
      }
    });
  });

  it('sends SET_ACTIVE_WORK_ITEM_PARENT with parent id', async () => {
    const response = { ok: true, result: null };

    sendMessageMock.mockResolvedValue(response);

    await expect(setActiveWorkItemParent(999)).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'SET_ACTIVE_WORK_ITEM_PARENT',
      payload: { parentId: 999 }
    });
  });
});
