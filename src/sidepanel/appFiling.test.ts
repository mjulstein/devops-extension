import { appFolderFor } from './appFiling';
import { readAppFolders } from './appGroups';

const folders = readAppFolders({
  id: 'apps',
  children: [
    {
      id: 'f1',
      title: 'example.com',
      children: [
        { id: 's1', title: 'example.com/spaces', children: [] },
        { id: 's2', title: 'wiki.example.com', children: [] }
      ]
    },
    { id: 'f2', title: 'sub.example.com', children: [] }
  ]
});

describe('appFolderFor', () => {
  it('files a page under the app whose host covers it', () => {
    expect(appFolderFor(folders, 'https://example.com/report')?.name).toBe(
      'example.com'
    );
  });

  it('prefers the sub-group that covers it', () => {
    expect(appFolderFor(folders, 'https://example.com/spaces/eng')?.name).toBe(
      'example.com/spaces'
    );
  });

  it('reads a sub-group named for another host as one too', () => {
    expect(appFolderFor(folders, 'https://wiki.example.com/x')?.name).toBe(
      'wiki.example.com'
    );
  });

  it('gives the more specific app, not the domain above it', () => {
    expect(appFolderFor(folders, 'https://sub.example.com/x')?.name).toBe(
      'sub.example.com'
    );
  });

  it('is nothing for an address no app covers', () => {
    // Left where the browser put it: nobody asked about this one.
    expect(appFolderFor(folders, 'https://other.test/')).toBeNull();
  });

  it('is nothing for an address that cannot be read', () => {
    expect(appFolderFor(folders, 'not a url')).toBeNull();
  });
});
