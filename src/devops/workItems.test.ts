import type { FetchWorkItemsRequest } from '@/types';
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

  it('uses separate open and closed WIQL requests and enriches parent summaries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ workItems: [{ id: 101 }] }))
      .mockResolvedValueOnce(createJsonResponse({ workItems: [{ id: 202 }] }))
      .mockResolvedValueOnce(
        createJsonResponse({
          value: [
            {
              fields: {
                'System.Id': 101,
                'System.WorkItemType': 'Task',
                'System.Title': 'Open task',
                'System.State': 'To Do',
                'System.AssignedTo': 'Current User',
                'System.Parent': 900
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          value: [
            {
              fields: {
                'System.Id': 202,
                'System.WorkItemType': 'Bug',
                'System.Title': 'Closed bug',
                'System.State': 'Done',
                'System.AssignedTo': 'Current User',
                'System.Parent': 900,
                'Microsoft.VSTS.Common.ClosedDate': '2026-03-16T16:30:00.000Z'
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          value: [
            {
              fields: {
                'System.Id': 900,
                'System.WorkItemType': 'PBI',
                'System.Title': 'Parent item'
              }
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          value: [
            {
              fields: {
                'System.Id': 900,
                'System.WorkItemType': 'PBI',
                'System.Title': 'Parent item'
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const request: FetchWorkItemsRequest = {
      settings: {
        organization: '',
        project: '',
        assignedTo: '   '
      },
      closedDateRange: {
        start: '2026-03-10',
        end: '2026-03-17'
      },
      scope: 'all'
    };

    await expect(
      fetchWorkItems(request, {
        organization: 'my-org',
        project: 'my-project'
      })
    ).resolves.toEqual({
      count: 2,
      openItems: [
        {
          id: 101,
          workItemType: 'Task',
          title: 'Open task',
          state: 'To Do',
          assignedTo: 'Current User',
          parentId: 900,
          parent: {
            id: 900,
            title: 'Parent item',
            workItemType: 'PBI',
            url: 'https://dev.azure.com/my-org/my-project/_workitems/edit/900'
          },
          closedDate: null,
          url: 'https://dev.azure.com/my-org/my-project/_workitems/edit/101'
        }
      ],
      closedItems: [
        {
          id: 202,
          workItemType: 'Bug',
          title: 'Closed bug',
          state: 'Done',
          assignedTo: 'Current User',
          parentId: 900,
          parent: {
            id: 900,
            title: 'Parent item',
            workItemType: 'PBI',
            url: 'https://dev.azure.com/my-org/my-project/_workitems/edit/900'
          },
          closedDate: '2026-03-16T16:30:00.000Z',
          url: 'https://dev.azure.com/my-org/my-project/_workitems/edit/202'
        }
      ],
      closedDateRange: request.closedDateRange
    });

    expect(fetchMock).toHaveBeenCalledTimes(6);

    const [, openWiqlRequest] = fetchMock.mock.calls[0] as [
      string,
      RequestInit
    ];
    const [, closedWiqlRequest] = fetchMock.mock.calls[1] as [
      string,
      RequestInit
    ];

    expect(getQueryFromRequestBody(openWiqlRequest.body)).toContain(
      '[System.AssignedTo] = @Me'
    );
    expect(getQueryFromRequestBody(openWiqlRequest.body)).toContain(
      "[System.State] IN ('To Do', 'In Progress')"
    );
    expect(getQueryFromRequestBody(closedWiqlRequest.body)).toContain(
      "[System.State] IN ('Done', 'Closed')"
    );
    expect(getQueryFromRequestBody(closedWiqlRequest.body)).toContain(
      "[Microsoft.VSTS.Common.ClosedDate] >= '2026-03-10'"
    );
    expect(getQueryFromRequestBody(closedWiqlRequest.body)).toContain(
      "[Microsoft.VSTS.Common.ClosedDate] < '2026-03-18'"
    );
  });

  it('quotes and escapes explicit assignedTo values in both requests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ workItems: [] }))
      .mockResolvedValueOnce(createJsonResponse({ workItems: [] }));

    vi.stubGlobal('fetch', fetchMock);

    const request: FetchWorkItemsRequest = {
      settings: {
        organization: '',
        project: '',
        assignedTo: "O'Brien"
      },
      closedDateRange: {
        start: '2026-03-10',
        end: '2026-03-17'
      },
      scope: 'all'
    };

    await expect(
      fetchWorkItems(request, {
        organization: 'my-org',
        project: 'my-project'
      })
    ).resolves.toEqual({
      count: 0,
      openItems: [],
      closedItems: [],
      closedDateRange: request.closedDateRange
    });

    const [, openWiqlRequest] = fetchMock.mock.calls[0] as [
      string,
      RequestInit
    ];
    const [, closedWiqlRequest] = fetchMock.mock.calls[1] as [
      string,
      RequestInit
    ];

    expect(getQueryFromRequestBody(openWiqlRequest.body)).toContain(
      "[System.AssignedTo] = 'O''Brien'"
    );
    expect(getQueryFromRequestBody(closedWiqlRequest.body)).toContain(
      "[System.AssignedTo] = 'O''Brien'"
    );
  });

  it('fetches only closed items when scope is closed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(createJsonResponse({ workItems: [{ id: 202 }] }))
      .mockResolvedValueOnce(
        createJsonResponse({
          value: [
            {
              fields: {
                'System.Id': 202,
                'System.WorkItemType': 'Bug',
                'System.Title': 'Closed bug',
                'System.State': 'Done',
                'System.AssignedTo': 'Current User',
                'Microsoft.VSTS.Common.ClosedDate': '2026-03-16T16:30:00.000Z'
              }
            }
          ]
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const request: FetchWorkItemsRequest = {
      settings: {
        organization: '',
        project: '',
        assignedTo: ''
      },
      closedDateRange: {
        start: '2026-03-16',
        end: '2026-03-16'
      },
      scope: 'closed'
    };

    await expect(
      fetchWorkItems(request, {
        organization: 'my-org',
        project: 'my-project'
      })
    ).resolves.toEqual({
      count: 1,
      openItems: [],
      closedItems: [
        {
          id: 202,
          workItemType: 'Bug',
          title: 'Closed bug',
          state: 'Done',
          assignedTo: 'Current User',
          parentId: null,
          parent: null,
          closedDate: '2026-03-16T16:30:00.000Z',
          url: 'https://dev.azure.com/my-org/my-project/_workitems/edit/202'
        }
      ],
      closedDateRange: request.closedDateRange
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, closedWiqlRequest] = fetchMock.mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(getQueryFromRequestBody(closedWiqlRequest.body)).toContain(
      "[System.State] IN ('Done', 'Closed')"
    );
  });
});

function createJsonResponse(body: unknown) {
  return {
    ok: true,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve('')
  };
}
