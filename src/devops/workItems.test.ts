import type { Settings } from '@/types';
import { fetchWorkItems } from './workItems';

function getQueryFromRequestBody(body: BodyInit | null | undefined): string {
  if (typeof body !== 'string') {
    throw new Error('Expected fetch request body to be a JSON string.');
  }

  const requestBody = JSON.parse(body) as {
    query: string;
  };

  return requestBody.query;
}

describe('workItems.ts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the current signed-in user when assignedTo is blank', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ workItems: [] })
    });

    vi.stubGlobal('fetch', fetchMock);

    const settings: Settings = {
      organization: '',
      project: '',
      assignedTo: '   '
    };

    await expect(
      fetchWorkItems(settings, {
        organization: 'my-org',
        project: 'my-project'
      })
    ).resolves.toEqual({
      count: 0,
      openItems: [],
      closedItems: []
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(getQueryFromRequestBody(requestInit.body)).toContain(
      '[System.AssignedTo] = @Me'
    );
  });

  it('quotes and escapes explicit assignedTo values', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ workItems: [] })
    });

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWorkItems(
        {
          organization: '',
          project: '',
          assignedTo: "O'Brien"
        },
        {
          organization: 'my-org',
          project: 'my-project'
        }
      )
    ).resolves.toEqual({
      count: 0,
      openItems: [],
      closedItems: []
    });

    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(getQueryFromRequestBody(requestInit.body)).toContain(
      "[System.AssignedTo] = 'O''Brien'"
    );
  });
});
