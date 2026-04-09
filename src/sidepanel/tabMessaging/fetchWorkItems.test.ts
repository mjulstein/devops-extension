import { fetchWorkItems } from './fetchWorkItems';
import type { FetchWorkItemsRequest } from '@/types';

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
    const request: FetchWorkItemsRequest = {
      settings: {
        organization: '',
        project: '',
        assignedTo: 'User Name',
        todoStates: []
      },
      closedDateRange: {
        start: '2026-03-10',
        end: '2026-03-17'
      },
      scope: 'all'
    };
    const response = {
      ok: true,
      result: {
        count: 0,
        openItems: [],
        closedItems: [],
        closedDateRange: request.closedDateRange
      }
    };

    sendMessageMock
      .mockResolvedValueOnce({ ok: true, result: 'pong' })
      .mockResolvedValueOnce(response);

    await expect(fetchWorkItems(request)).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenNthCalledWith(1, {
      type: 'PING_SERVICE_WORKER'
    });
    expect(sendMessageMock).toHaveBeenNthCalledWith(2, {
      type: 'FETCH_WORK_ITEMS',
      payload: request
    });
  });

  it('propagates runtime errors', async () => {
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, result: 'pong' })
      .mockRejectedValueOnce(new Error('runtime unavailable'));

    await expect(
      fetchWorkItems({
        settings: {
          organization: '',
          project: '',
          assignedTo: 'User Name',
          todoStates: []
        },
        closedDateRange: {
          start: '2026-03-10',
          end: '2026-03-17'
        },
        scope: 'all'
      })
    ).rejects.toThrow('runtime unavailable');
  });

  it('fails with timeout when runtime never responds', async () => {
    vi.useFakeTimers();
    sendMessageMock
      .mockResolvedValueOnce({ ok: true, result: 'pong' })
      .mockImplementationOnce(() => new Promise(() => undefined));

    const promise = fetchWorkItems({
      settings: {
        organization: '',
        project: '',
        assignedTo: 'User Name',
        todoStates: []
      },
      closedDateRange: {
        start: '2026-03-10',
        end: '2026-03-17'
      },
      scope: 'all'
    });
    const settled = promise.then(
      () => null,
      (error: unknown) =>
        error instanceof Error ? error : new Error(String(error))
    );

    await vi.advanceTimersByTimeAsync(45001);
    await expect(settled).resolves.toBeInstanceOf(Error);
    await expect(settled).resolves.toMatchObject({
      message:
        'Timed out while waiting for work-item fetch response from service worker.'
    });
  });
});
