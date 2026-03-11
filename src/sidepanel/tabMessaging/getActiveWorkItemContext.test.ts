import { getActiveWorkItemContext } from './getActiveWorkItemContext';

const queryMock = vi.fn();
const sendMessageMock = vi.fn();

describe('getActiveWorkItemContext.test.ts', () => {
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

  it('sends GET_ACTIVE_WORK_ITEM_CONTEXT with forceResync false by default', async () => {
    const response = { ok: true, result: { current: {}, parentId: null } };

    queryMock.mockResolvedValue([{ id: 9 }]);
    sendMessageMock.mockResolvedValue(response);

    await expect(getActiveWorkItemContext()).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenCalledWith(9, {
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT',
      payload: { forceResync: false }
    });
  });

  it('sends GET_ACTIVE_WORK_ITEM_CONTEXT with forceResync true when requested', async () => {
    const response = { ok: true, result: { current: {}, parentId: null } };

    queryMock.mockResolvedValue([{ id: 9 }]);
    sendMessageMock.mockResolvedValue(response);

    await expect(getActiveWorkItemContext(true)).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenCalledWith(9, {
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT',
      payload: { forceResync: true }
    });
  });
});
