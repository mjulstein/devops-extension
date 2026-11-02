import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Two files in one directory whose names differ only in case.
 *
 * Linux keeps them apart and macOS and Windows do not, so an import of
 * `./WindowDeck` resolves to whichever of `WindowDeck.tsx` and `windowDeck.ts`
 * the filesystem meets first. The build then fails on one developer's machine
 * and nowhere else, with an error about a missing export that has nothing
 * obviously to do with the filename.
 *
 * The repository's own convention makes this easy to walk into — components
 * are `PascalCase.tsx` and utilities are `camelCase.ts` — so it is worth a
 * test rather than a rule nobody remembers.
 */
function collisionsIn(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const seen = new Map<string, string>();
  const found: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      found.push(...collisionsIn(join(dir, entry.name)));
      continue;
    }
    // The extension is part of what the filesystem matches on, and an import
    // written without one is what goes looking: `a.ts` and `a.tsx` are a real
    // pair the resolver orders deliberately, so only the stem is compared.
    const stem = entry.name.replace(/\.[^.]*$/, '');
    const previous = seen.get(stem.toLowerCase());
    // The same stem with two extensions is an ordinary pair — `bookmarks.html`
    // and `bookmarks.tsx` are the page and its script. Only a difference in
    // case is a collision, because that is the one a filesystem may erase.
    if (previous !== undefined && previous !== stem) {
      found.push(`${dir}: ${previous} and ${stem}`);
    }
    seen.set(stem.toLowerCase(), stem);
  }

  return found;
}

describe('file names', () => {
  it('has no two names in a directory differing only in case', () => {
    expect(collisionsIn('src')).toEqual([]);
  });
});
