import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SeoMeta } from './SeoMeta';

describe('SeoMeta', () => {
  afterEach(() => {
    cleanup();
    document.title = '';
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:url"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'link[rel="canonical"]',
    ]) {
      document.head.querySelector(selector)?.remove();
    }
  });

  it('keeps metadata title separate from the browser tab title', () => {
    render(
      <SeoMeta
        title="Free Online PO Editor for PO, POT and JSON — GlossBoss"
        browserTitle="Editor — GlossBoss"
        description="Open PO files in your browser."
        canonicalPath="/editor"
      />,
    );

    expect(document.title).toBe('Editor — GlossBoss');
    expect(document.head.querySelector('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'Free Online PO Editor for PO, POT and JSON — GlossBoss',
    );
    expect(document.head.querySelector('meta[name="twitter:title"]')).toHaveAttribute(
      'content',
      'Free Online PO Editor for PO, POT and JSON — GlossBoss',
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://glossboss.ink/editor',
    );
  });
});
