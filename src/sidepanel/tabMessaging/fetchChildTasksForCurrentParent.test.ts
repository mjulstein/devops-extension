import { fetchChildTasksForCurrentParent } from './fetchChildTasksForCurrentParent';

const queryMock = vi.fn();
const sendMessageMock = vi.fn();

describe('fetchChildTasksForCurrentParent.test.ts', () => {
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

  it('sends FETCH_CHILD_TASKS_FOR_CURRENT_PARENT for preferred parent id', async () => {
    const response = { ok: true, result: [] };

    queryMock.mockResolvedValue([{ id: 13 }]);
    sendMessageMock.mockResolvedValue(response);

    await expect(fetchChildTasksForCurrentParent(700)).resolves.toEqual(
      response
    );
    expect(sendMessageMock).toHaveBeenCalledWith(13, {
      type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT',
      payload: { preferredParentId: 700 }
    });
  });
});
