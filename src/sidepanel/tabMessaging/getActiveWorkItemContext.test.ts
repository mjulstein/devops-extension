import { getActiveWorkItemContext } from './getActiveWorkItemContext';

const sendMessageMock = vi.fn();

describe('getActiveWorkItemContext.test.ts', () => {
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

  it('sends GET_ACTIVE_WORK_ITEM_CONTEXT with forceResync false by default', async () => {
    const response = { ok: true, result: { current: {}, parentId: null } };

    sendMessageMock.mockResolvedValue(response);

    await expect(getActiveWorkItemContext()).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT',
      payload: { forceResync: false }
    });
  });

  it('sends GET_ACTIVE_WORK_ITEM_CONTEXT with forceResync true when requested', async () => {
    const response = { ok: true, result: { current: {}, parentId: null } };

    sendMessageMock.mockResolvedValue(response);

    await expect(getActiveWorkItemContext(true)).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'GET_ACTIVE_WORK_ITEM_CONTEXT',
      payload: { forceResync: true }
    });
  });
});
