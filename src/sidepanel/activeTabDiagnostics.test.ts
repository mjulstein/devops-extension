import { describeActiveTab } from './activeTabDiagnostics';

describe('describeActiveTab', () => {
  it('names the origin it recognised', () => {
    const text = describeActiveTab({
      url: 'https://dev.azure.com/org/proj/_boards',
      isAzureDevOps: true
    });

    expect(text).toContain('https://dev.azure.com');
    expect(text).toContain('recognised as Azure DevOps');
  });

  it('says what would have been recognised when it was not', () => {
    const text = describeActiveTab({
      url: 'https://example.test/page',
      isAzureDevOps: false
    });

    expect(text).toContain('https://example.test');
    expect(text).toContain('dev.azure.com');
  });

  it('separates an unreadable address from a wrong one', () => {
    const text = describeActiveTab({ url: null, isAzureDevOps: false });

    expect(text).toContain('cannot be read');
  });
});
