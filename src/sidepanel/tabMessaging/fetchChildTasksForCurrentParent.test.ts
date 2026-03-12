import { fetchChildTasksForCurrentParent } from './fetchChildTasksForCurrentParent';

const sendMessageMock = vi.fn();

describe('fetchChildTasksForCurrentParent.test.ts', () => {
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

  it('sends FETCH_CHILD_TASKS_FOR_CURRENT_PARENT for preferred parent id', async () => {
    const response = { ok: true, result: [] };

    sendMessageMock.mockResolvedValue(response);

    await expect(fetchChildTasksForCurrentParent(700)).resolves.toEqual(
      response
    );
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'FETCH_CHILD_TASKS_FOR_CURRENT_PARENT',
      payload: { preferredParentId: 700 }
    });
  });
});
