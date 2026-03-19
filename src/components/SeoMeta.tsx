import { useEffect } from 'react';

const SITE_URL = 'https://glossboss.ink';

function ensureMeta(selector: string, create: () => HTMLMetaElement): HTMLMetaElement {
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (existing) return existing;
  const meta = create();
  document.head.append(meta);
  return meta;
}

function ensureLink(selector: string, create: () => HTMLLinkElement): HTMLLinkElement {
  const existing = document.head.querySelector<HTMLLinkElement>(selector);
  if (existing) return existing;
  const link = create();
  document.head.append(link);
  return link;
}

export function SeoMeta({
  title,
  description,
  canonicalPath,
  robots,
}: {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
}) {
  useEffect(() => {
    const canonicalUrl = new URL(canonicalPath, SITE_URL).toString();

    document.title = title;

    const descriptionMeta = ensureMeta('meta[name="description"]', () => {
      const meta = document.createElement('meta');
      meta.name = 'description';
      return meta;
    });
    descriptionMeta.setAttribute('content', description);

    const canonicalLink = ensureLink('link[rel="canonical"]', () => {
      const link = document.createElement('link');
      link.rel = 'canonical';
      return link;
    });
    canonicalLink.href = canonicalUrl;

    const ogUrl = ensureMeta('meta[property="og:url"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:url');
      return meta;
    });
    ogUrl.setAttribute('content', canonicalUrl);

    const ogTitle = ensureMeta('meta[property="og:title"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      return meta;
    });
    ogTitle.setAttribute('content', title);

    const ogDescription = ensureMeta('meta[property="og:description"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:description');
      return meta;
    });
    ogDescription.setAttribute('content', description);

    const twitterTitle = ensureMeta('meta[name="twitter:title"]', () => {
      const meta = document.createElement('meta');
      meta.name = 'twitter:title';
      return meta;
    });
    twitterTitle.setAttribute('content', title);

    const twitterDescription = ensureMeta('meta[name="twitter:description"]', () => {
      const meta = document.createElement('meta');
      meta.name = 'twitter:description';
      return meta;
    });
    twitterDescription.setAttribute('content', description);

    if (robots) {
      const robotsMeta = ensureMeta('meta[name="robots"]', () => {
        const meta = document.createElement('meta');
        meta.name = 'robots';
        return meta;
      });
      robotsMeta.setAttribute('content', robots);
    }
  }, [canonicalPath, description, robots, title]);

  return null;
}
