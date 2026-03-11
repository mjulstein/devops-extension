import { fetchWorkItems } from './fetchWorkItems';
import type { Settings } from '@/types';

const queryMock = vi.fn();
const sendMessageMock = vi.fn();

describe('fetchWorkItems.test.ts', () => {
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

  it('sends FETCH_WORK_ITEMS for the active tab', async () => {
    const settings: Settings = { assignedTo: 'User Name' };
    const response = { ok: true, result: { todo: [], closedLastWeek: [] } };

    queryMock.mockResolvedValue([{ id: 7 }]);
    sendMessageMock.mockResolvedValue(response);

    await expect(fetchWorkItems(settings)).resolves.toEqual(response);
    expect(sendMessageMock).toHaveBeenCalledWith(7, {
      type: 'FETCH_WORK_ITEMS',
      payload: settings
    });
  });

  it('maps receiving-end errors to a refresh message', async () => {
    queryMock.mockResolvedValue([{ id: 7 }]);
    sendMessageMock.mockRejectedValue(
      new Error('Could not establish connection. Receiving end does not exist.')
    );

    await expect(fetchWorkItems({ assignedTo: 'User Name' })).rejects.toThrow(
      'Extension reloaded. Refresh the active Azure DevOps tab, then try again.'
    );
  });
});
