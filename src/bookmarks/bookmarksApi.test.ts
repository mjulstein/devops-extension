import { splitIntoFolder } from './bookmarksApi';

describe('splitIntoFolder', () => {
  const calls: { created?: unknown; moved?: unknown } = {};

  beforeEach(() => {
    calls.created = undefined;
    calls.moved = undefined;
    globalThis.chrome = {
      bookmarks: {
        get: (id: string) =>
          Promise.resolve([
            {
              id,
              parentId: 'app',
              index: 2,
              title: 'Report',
              url: 'https://example.com/report'
            }
          ]),
        create: (info: unknown) => {
          calls.created = info;
          return Promise.resolve({ id: 'new-folder' });
        },
        move: (id: string, info: unknown) => {
          calls.moved = { id, ...(info as object) };
          return Promise.resolve();
        }
      }
    } as unknown as typeof chrome;
  });

  it('puts the folder where the bookmark was, under its name', () => {
    // It takes the bookmark's place so the list does not rearrange itself
    // under somebody who was only adding a level.
    return splitIntoFolder('b1').then(() => {
      expect(calls.created).toEqual({
        parentId: 'app',
        title: 'Report',
        index: 2
      });
      expect(calls.moved).toEqual({ id: 'b1', parentId: 'new-folder' });
    });
  });

  it('leaves a folder alone', async () => {
    globalThis.chrome = {
      bookmarks: {
        get: () =>
          Promise.resolve([{ id: 'f', parentId: 'app', title: 'Already' }]),
        create: () => Promise.reject(new Error('should not create')),
        move: () => Promise.reject(new Error('should not move'))
      }
    } as unknown as typeof chrome;
    await expect(splitIntoFolder('f')).resolves.toBeUndefined();
  });
});
