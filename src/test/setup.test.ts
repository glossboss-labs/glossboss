import { beforeEach, describe, expect, it } from 'vitest';

describe('test storage mocks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('enumerates stored keys without exposing Storage API methods', () => {
    localStorage.setItem('glossboss-cache-nl', 'cached glossary');

    expect(Object.keys(localStorage)).toEqual(['glossboss-cache-nl']);
    expect(localStorage.key(0)).toBe('glossboss-cache-nl');
  });

  it('keeps reserved storage keys addressable without overwriting the API', () => {
    localStorage.setItem('getItem', 'reserved key');

    expect(typeof localStorage.getItem).toBe('function');
    expect(localStorage.getItem('getItem')).toBe('reserved key');
  });
});
