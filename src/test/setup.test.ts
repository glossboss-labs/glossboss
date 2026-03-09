import { describe, expect, it } from 'vitest';

describe('storage test setup', () => {
  it('enumerates stored keys via Object.keys and Storage.key()', () => {
    localStorage.setItem('glossboss-wp-glossary-nl', 'cached');

    expect(Object.keys(localStorage)).toContain('glossboss-wp-glossary-nl');
    expect(localStorage.key(0)).toBe('glossboss-wp-glossary-nl');
  });

  it('stores keys that collide with Storage API names without replacing methods', () => {
    localStorage.setItem('getItem', 'value');

    expect(localStorage.getItem('getItem')).toBe('value');
    expect(typeof localStorage.getItem).toBe('function');
    expect(Object.keys(localStorage)).toContain('getItem');
  });
});
