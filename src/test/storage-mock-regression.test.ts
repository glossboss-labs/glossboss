import { beforeEach, describe, expect, it } from 'vitest';

describe('storage mock regression coverage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('only enumerates stored keys for a single entry', () => {
    localStorage.setItem('glossboss-wp-glossary-nl', 'cached');

    expect(Object.keys(localStorage)).toEqual(['glossboss-wp-glossary-nl']);
  });
});
