import {
  buildWordPressReleaseList,
  buildWordPressTranslationExportUrl,
  fetchWordPressProjectInfo,
  sortWordPressReleases,
  validateWordPressProjectSlug,
} from './project';

describe('sortWordPressReleases', () => {
  it('keeps version-like releases in descending order and drops non-release labels', () => {
    expect(sortWordPressReleases(['trunk', '2.0', '1.10', '1.2.0', 'beta-1'])).toEqual([
      '2.0',
      '1.10',
      '1.2.0',
    ]);
  });
});

describe('buildWordPressReleaseList', () => {
  it('deduplicates release fallbacks and keeps descending order', () => {
    expect(buildWordPressReleaseList(['1.7.2', null, '1.6', '1.7.2', undefined])).toEqual([
      '1.7.2',
      '1.6',
    ]);
  });
});

describe('buildWordPressTranslationExportUrl', () => {
  it('builds plugin export URLs with the selected translation track', () => {
    expect(
      buildWordPressTranslationExportUrl({
        projectType: 'plugin',
        slug: 'hello-dolly',
        locale: 'nl_NL',
        track: 'dev',
      }),
    ).toBe(
      'https://translate.wordpress.org/projects/wp-plugins/hello-dolly/dev/nl-nl/default/export-translations/?format=po',
    );
  });

  it('builds theme export URLs without a plugin track segment', () => {
    expect(
      buildWordPressTranslationExportUrl({
        projectType: 'theme',
        slug: 'twentytwentyfive',
        locale: 'nl-NL',
      }),
    ).toBe(
      'https://translate.wordpress.org/projects/wp-themes/twentytwentyfive/nl-nl/default/export-translations/?format=po',
    );
  });
});

describe('fetchWordPressProjectInfo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses plugin project info responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ name: 'Hello Dolly', version: '1.7.2' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWordPressProjectInfo('plugin', 'hello-dolly')).resolves.toEqual({
      type: 'plugin',
      slug: 'hello-dolly',
      name: 'Hello Dolly',
      latestVersion: '1.7.2',
      supportsDevelopmentTrack: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://api.wordpress.org/plugins/info/1.2/'),
    );
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('slug=hello-dolly'));
  });

  it('returns false from slug validation when project info lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not found', { status: 404 })));

    await expect(validateWordPressProjectSlug('theme', 'missing-theme')).resolves.toBe(false);
  });
});
