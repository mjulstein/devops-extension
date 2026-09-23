import { parseFavoritesQuery } from './favoritesQuery';

describe('parseFavoritesQuery', () => {
  it('searches the favorites by default', () => {
    expect(parseFavoritesQuery('board')).toEqual({
      scope: 'favorites',
      term: 'board'
    });
  });

  it('widens to every bookmark on a leading period, which is not part of the term', () => {
    expect(parseFavoritesQuery('.board')).toEqual({
      scope: 'all',
      term: 'board'
    });
  });

  it('treats a lone period as asking for everything, not as a search for a period', () => {
    expect(parseFavoritesQuery('.')).toEqual({ scope: 'all', term: '' });
  });

  it('only reads the first character, so a period inside a term stays part of it', () => {
    expect(parseFavoritesQuery('dev.azure')).toEqual({
      scope: 'favorites',
      term: 'dev.azure'
    });
    expect(parseFavoritesQuery('.dev.azure')).toEqual({
      scope: 'all',
      term: 'dev.azure'
    });
  });
});
