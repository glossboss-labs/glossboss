import { describe, expect, it } from 'vitest';
import { buildWordPressProjectSearchUrl, parseWordPressProjectSearchResults } from './search';

describe('buildWordPressProjectSearchUrl', () => {
  it('builds plugin query urls with a capped result count', () => {
    const url = new URL(buildWordPressProjectSearchUrl('plugin', 'woo', 99));

    expect(url.origin).toBe('https://api.wordpress.org');
    expect(url.pathname).toBe('/plugins/info/1.2/');
    expect(url.searchParams.get('action')).toBe('query_plugins');
    expect(url.searchParams.get('request[search]')).toBe('woo');
    expect(url.searchParams.get('request[per_page]')).toBe('8');
  });

  it('builds theme query urls', () => {
    const url = new URL(buildWordPressProjectSearchUrl('theme', 'block', 5));

    expect(url.pathname).toBe('/themes/info/1.2/');
    expect(url.searchParams.get('action')).toBe('query_themes');
    expect(url.searchParams.get('request[per_page]')).toBe('5');
  });
});

describe('parseWordPressProjectSearchResults', () => {
  it('parses plugin suggestions', () => {
    expect(
      parseWordPressProjectSearchResults('plugin', {
        plugins: [
          { slug: 'woocommerce', name: 'WooCommerce', version: '10.0.0' },
          { slug: 'woocommerce', name: 'Duplicate', version: '10.0.0' },
          { slug: 'hello-dolly', name: 'Hello Dolly' },
        ],
      }),
    ).toEqual([
      { slug: 'woocommerce', name: 'WooCommerce', version: '10.0.0' },
      { slug: 'hello-dolly', name: 'Hello Dolly', version: null },
    ]);
  });

  it('parses theme suggestions', () => {
    expect(
      parseWordPressProjectSearchResults('theme', {
        themes: [{ slug: 'twentytwentyfive', name: 'Twenty Twenty-Five', version: '1.2' }],
      }),
    ).toEqual([{ slug: 'twentytwentyfive', name: 'Twenty Twenty-Five', version: '1.2' }]);
  });
});
