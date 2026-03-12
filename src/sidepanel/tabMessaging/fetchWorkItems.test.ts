import { fetchWorkItems } from './fetchWorkItems';
import type { Settings } from '@/types';

const sendMessageMock = vi.fn();

describe('fetchWorkItems.test.ts', () => {
  beforeEach(() => {
    vi.useRealTimers();
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

  it('sends FETCH_WORK_ITEMS to runtime', async () => {
    const settings: Settings = {
      organization: '',
      project: '',
      assignedTo: 'User Name'
    };
    const response = {
      ok: true,
      result: { count: 0, openItems: [], closedItems: [] }
    };

    sendMessageMock
      .mockResolvedValueOnce({ ok: true, result: 'pong' })
      .mockResolvedValueOnce(response);

    await expect(fetchWorkItems(settings)).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'PING_SERVICE_WORKER'
    });
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'FETCH_WORK_ITEMS',
      payload: settings
    });
  });

  it('propagates runtime errors', async () => {
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, result: 'pong' })
      .mockRejectedValueOnce(new Error('runtime unavailable'));

    await expect(
      fetchWorkItems({ organization: '', project: '', assignedTo: 'User Name' })
    ).rejects.toThrow('runtime unavailable');
  });

  it('fails with timeout when runtime never responds', async () => {
    vi.useFakeTimers();
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, result: 'pong' })
      .mockImplementationOnce(() => new Promise(() => undefined));

    const promise = fetchWorkItems({
      organization: '',
      project: '',
      assignedTo: 'User Name'
    });

    const expectation = expect(promise).rejects.toThrow(
      'Timed out while waiting for work-item fetch response from service worker.'
    );

    await vi.advanceTimersByTimeAsync(45001);
    await expectation;
  });
});
