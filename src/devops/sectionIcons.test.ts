import {
  adoSectionOf,
  fallbackSectionIcon,
  sectionIconForUrl
} from './sectionIcons';

describe('adoSectionOf', () => {
  it('reads the section out of the path', () => {
    expect(adoSectionOf('https://dev.azure.com/org/proj/_boards/board')).toBe(
      'boards'
    );
    expect(adoSectionOf('https://dev.azure.com/org/proj/_git/repo')).toBe(
      'repos'
    );
    expect(adoSectionOf('https://dev.azure.com/org/proj/_build?id=4')).toBe(
      'pipelines'
    );
    expect(adoSectionOf('https://dev.azure.com/org/proj/_wiki/x')).toBe('wiki');
  });

  it('falls back to overview for an Azure DevOps url it does not recognise', () => {
    expect(adoSectionOf('https://dev.azure.com/org/proj')).toBe('overview');
  });

  it('covers the legacy host too', () => {
    expect(adoSectionOf('https://acme.visualstudio.com/p/_git/r')).toBe(
      'repos'
    );
  });

  it('is null for anywhere else, so the site favicon is used', () => {
    expect(adoSectionOf('https://github.com/x/_git/y')).toBeNull();
    expect(adoSectionOf('not a url')).toBeNull();
  });
});

describe('sectionIconForUrl', () => {
  const boards = 'https://dev.azure.com/org/proj/_boards/board';

  it('prefers the scraped icon when one has been cached', () => {
    expect(
      sectionIconForUrl(boards, { boards: 'https://cdn.test/b.png' })
    ).toBe('https://cdn.test/b.png');
  });

  it('uses the built-in icon when nothing has been scraped yet', () => {
    expect(sectionIconForUrl(boards, {})).toBe(fallbackSectionIcon('boards'));
  });

  it('gives different pictures to different sections', () => {
    const board = sectionIconForUrl(boards, {});
    const repo = sectionIconForUrl('https://dev.azure.com/o/p/_git/r', {});
    // The whole point: one origin, one site favicon, but these must differ.
    expect(board).not.toBe(repo);
  });

  it('declines a url that is not Azure DevOps', () => {
    expect(sectionIconForUrl('https://example.test/_boards', {})).toBeNull();
  });
});
