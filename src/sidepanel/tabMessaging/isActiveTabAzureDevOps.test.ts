import { isActiveTabAzureDevOps } from './isActiveTabAzureDevOps';

const queryMock = vi.fn();

describe('isActiveTabAzureDevOps.test.ts', () => {
  beforeEach(() => {
    queryMock.mockReset();

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        tabs: {
          query: queryMock
        }
      }
    });
  });

  it('returns true for dev.azure.com URLs', async () => {
    queryMock.mockResolvedValue([{ url: 'https://dev.azure.com/org/project' }]);

    await expect(isActiveTabAzureDevOps()).resolves.toBe(true);
  });

  it('returns true for visualstudio.com URLs', async () => {
    queryMock.mockResolvedValue([
      { url: 'https://org.visualstudio.com/DefaultCollection' }
    ]);

    await expect(isActiveTabAzureDevOps()).resolves.toBe(true);
  });

  it('returns false for non Azure DevOps URLs', async () => {
    queryMock.mockResolvedValue([{ url: 'https://example.com' }]);

    await expect(isActiveTabAzureDevOps()).resolves.toBe(false);
  });
});
