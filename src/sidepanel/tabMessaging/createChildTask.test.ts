import { createChildTask } from './createChildTask';

const queryMock = vi.fn();
const sendMessageMock = vi.fn();

describe('createChildTask.test.ts', () => {
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

  it('sends CREATE_CHILD_TASK with title and parent id', async () => {
    const response = { ok: true, result: { id: 101, title: 'New task' } };

    queryMock.mockResolvedValue([{ id: 11 }]);
    sendMessageMock.mockResolvedValue(response);

    await expect(createChildTask('New task', 500)).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenCalledWith(11, {
      type: 'CREATE_CHILD_TASK',
      payload: { title: 'New task', preferredParentId: 500 }
    });
  });
});
