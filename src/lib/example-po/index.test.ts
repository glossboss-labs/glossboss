import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildExamplePoFilename,
  buildExamplePoWordPressUrls,
  clearExamplePoCacheForTests,
  fetchExamplePoFromWordPress,
  getBundledExamplePo,
  getDeviceExampleTargetLanguage,
  isValidHelloDollyPo,
} from './index';

const WORDPRESS_EXAMPLE_PO = `
msgid ""
msgstr ""
"Project-Id-Version: Hello Dolly 1.7.2\\n"
"Report-Msgid-Bugs-To: https://wordpress.org/support/plugin/hello-dolly/\\n"
"POT-Creation-Date: 2025-01-01 00:00+0000\\n"
"PO-Revision-Date: 2025-01-01 00:00+0000\\n"
"Last-Translator: GlossBoss Example\\n"
"Language-Team: German\\n"
"Language: de_DE\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"X-Domain: hello-dolly\\n"

#: hello.php:18
msgid "Hello Dolly"
msgstr "Hallo Dolly"
`.trim();

describe('example PO helpers', () => {
  beforeEach(() => {
    clearExamplePoCacheForTests();
  });

  it('maps navigator locales to supported example target languages', () => {
    expect(
      getDeviceExampleTargetLanguage({
        language: 'de-DE',
        languages: ['de-DE', 'en-US'],
      }),
    ).toBe('DE');
    expect(
      getDeviceExampleTargetLanguage({
        language: 'en_GB',
        languages: ['en_GB'],
      }),
    ).toBe('EN-GB');
    expect(
      getDeviceExampleTargetLanguage({
        language: 'pt',
        languages: ['pt'],
      }),
    ).toBe('PT-PT');
  });

  it('builds WordPress export URLs for locale-aware example downloads', () => {
    expect(buildExamplePoWordPressUrls('DE')).toEqual([
      'https://translate.wordpress.org/projects/wp-plugins/hello-dolly/stable/de/default/export-translations/?format=po',
      'https://translate.wordpress.org/projects/wp-plugins/hello-dolly/dev/de/default/export-translations/?format=po',
    ]);
    expect(buildExamplePoWordPressUrls('EN-US')).toEqual([
      'https://translate.wordpress.org/projects/wp-plugins/hello-dolly/stable/en-us/default/export-translations/?format=po',
      'https://translate.wordpress.org/projects/wp-plugins/hello-dolly/dev/en-us/default/export-translations/?format=po',
      'https://translate.wordpress.org/projects/wp-plugins/hello-dolly/stable/en/default/export-translations/?format=po',
      'https://translate.wordpress.org/projects/wp-plugins/hello-dolly/dev/en/default/export-translations/?format=po',
    ]);
  });

  it('validates Hello Dolly PO content explicitly', () => {
    expect(isValidHelloDollyPo(WORDPRESS_EXAMPLE_PO)).toBe(true);
    expect(
      isValidHelloDollyPo(
        `
msgid ""
msgstr ""
"Language: de_DE\\n"
      `.trim(),
      ),
    ).toBe(false);
  });

  it('derives the localized example filename from PO language headers', () => {
    expect(buildExamplePoFilename('de_DE')).toBe('hello-dolly-de_DE.po');
    expect(buildExamplePoFilename('en-GB')).toBe('hello-dolly-en_GB.po');
    // Malformed locale headers should fall back instead of being silently rewritten.
    expect(buildExamplePoFilename('de DE')).toBe('hello-dolly-nl_NL.po');
    expect(buildExamplePoFilename('@@')).toBe('hello-dolly-nl_NL.po');
    expect(buildExamplePoFilename('zh_HANS')).toBe('hello-dolly-nl_NL.po');
    expect(buildExamplePoFilename(undefined, 'PT-BR')).toBe('hello-dolly-pt_BR.po');
    expect(getBundledExamplePo().filename).toBe('hello-dolly-nl_NL.po');
  });

  it('caches successful WordPress example fetches until cleared', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(WORDPRESS_EXAMPLE_PO, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    });

    const first = await fetchExamplePoFromWordPress('DE', fetchMock);
    const second = await fetchExamplePoFromWordPress('DE', fetchMock);

    expect(first).toEqual({
      content: WORDPRESS_EXAMPLE_PO,
      filename: 'hello-dolly-de_DE.po',
    });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    clearExamplePoCacheForTests();
    await fetchExamplePoFromWordPress('DE', fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
