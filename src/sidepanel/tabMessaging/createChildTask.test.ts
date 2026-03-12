import { createChildTask } from './createChildTask';

const sendMessageMock = vi.fn();

describe('createChildTask.test.ts', () => {
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

  it('sends CREATE_CHILD_TASK with title and parent id', async () => {
    const response = { ok: true, result: { id: 101, title: 'New task' } };

    sendMessageMock.mockResolvedValue(response);

    await expect(createChildTask('New task', 500)).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'CREATE_CHILD_TASK',
      payload: { title: 'New task', preferredParentId: 500 }
    });
  });
});
