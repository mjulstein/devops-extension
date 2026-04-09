import { navigateToWorkItem } from './navigateToWorkItem';

const tabsQueryMock = vi.fn();
const tabsUpdateMock = vi.fn();
const tabsCreateMock = vi.fn();
const windowsUpdateMock = vi.fn();

describe('navigateToWorkItem', () => {
  beforeEach(() => {
    tabsQueryMock.mockReset();
    tabsUpdateMock.mockReset();
    tabsCreateMock.mockReset();
    windowsUpdateMock.mockReset();

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        tabs: {
          query: tabsQueryMock,
          update: tabsUpdateMock,
          create: tabsCreateMock
        },
        windows: {
          update: windowsUpdateMock
        }
      }
    });
  });

  it('updates the active tab when the current tab is already Azure DevOps', async () => {
    tabsQueryMock.mockResolvedValue([{ id: 42 }]);
    tabsUpdateMock.mockResolvedValue(undefined);

    await expect(
      navigateToWorkItem(
        'https://dev.azure.com/example/Project/_workitems/edit/101',
        false
      )
    ).resolves.toBe('active-tab');

    expect(tabsQueryMock).toHaveBeenCalledWith({
      active: true,
      currentWindow: true
    });
    expect(tabsUpdateMock).toHaveBeenCalledWith(42, {
      url: 'https://dev.azure.com/example/Project/_workitems/edit/101'
    });
    expect(tabsCreateMock).not.toHaveBeenCalled();
  });

  it('activates an existing matching work-item tab when opened externally', async () => {
    tabsQueryMock.mockResolvedValue([
      {
        id: 12,
        windowId: 7,
        url: 'https://dev.azure.com/example/Project/_workitems/edit/202'
      },
      {
        id: 34,
        windowId: 8,
        url: 'https://dev.azure.com/example/Project/_workitems/edit/999'
      }
    ]);
    windowsUpdateMock.mockResolvedValue(undefined);
    tabsUpdateMock.mockResolvedValue(undefined);

    await expect(
      navigateToWorkItem(
        'https://dev.azure.com/example/Project/_workitems/edit/202',
        true
      )
    ).resolves.toBe('existing-tab');

    expect(tabsQueryMock).toHaveBeenCalledWith({});
    expect(windowsUpdateMock).toHaveBeenCalledWith(7, { focused: true });
    expect(tabsUpdateMock).toHaveBeenCalledWith(12, { active: true });
    expect(tabsCreateMock).not.toHaveBeenCalled();
  });

  it('opens a new tab when no matching work-item tab exists', async () => {
    tabsQueryMock.mockResolvedValue([
      {
        id: 34,
        windowId: 8,
        url: 'https://dev.azure.com/example/Project/_workitems/edit/999'
      }
    ]);
    tabsCreateMock.mockResolvedValue(undefined);

    await expect(
      navigateToWorkItem(
        'https://dev.azure.com/example/Project/_workitems/edit/303',
        true
      )
    ).resolves.toBe('new-tab');

    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'https://dev.azure.com/example/Project/_workitems/edit/303'
    });
    expect(tabsUpdateMock).not.toHaveBeenCalled();
  });

  it('falls back to opening a new tab when tab lookup fails', async () => {
    tabsQueryMock.mockRejectedValue(new Error('query failed'));
    tabsCreateMock.mockResolvedValue(undefined);

    await expect(
      navigateToWorkItem(
        'https://dev.azure.com/example/Project/_workitems/edit/404',
        true
      )
    ).resolves.toBe('new-tab');

    expect(tabsCreateMock).toHaveBeenCalledWith({
      url: 'https://dev.azure.com/example/Project/_workitems/edit/404'
    });
  });
});
