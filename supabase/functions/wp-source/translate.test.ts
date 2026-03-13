import { describe, expect, it } from 'vitest';
import { buildWordPressTranslationExportUrl, parseProjectLocalesFromHtml } from './translate';

describe('parseProjectLocalesFromHtml', () => {
  it('parses default plugin locales from translation set rows', () => {
    const html = `
      <table class="gp-table translation-sets">
        <tbody>
          <tr>
            <td><strong><a href="/projects/wp-plugins/admin-site-enhancements/stable/nl/default/">Dutch</a></strong></td>
          </tr>
          <tr>
            <td><strong><a href="/projects/wp-plugins/admin-site-enhancements/stable/fr/default/">French</a></strong></td>
          </tr>
          <tr>
            <td><strong><a href="/projects/wp-plugins/admin-site-enhancements/stable/de/formal/">German (Formal)</a></strong></td>
          </tr>
        </tbody>
      </table>
    `;

    expect(parseProjectLocalesFromHtml(html, 'plugin', 'admin-site-enhancements')).toEqual([
      { locale: 'nl', label: 'Dutch' },
      { locale: 'fr', label: 'French' },
    ]);
  });

  it('parses default theme locales from locale table rows', () => {
    const html = `
      <table id="stats-table" class="table">
        <tbody>
          <tr>
            <th title="nl_NL">
              <a href="/locale/nl/default/wp-themes/twentytwentyfive/">Dutch</a>
            </th>
            <td><a href="/projects/wp-themes/twentytwentyfive/nl/default/">100%</a></td>
          </tr>
          <tr>
            <th title="de_DE_formal">
              <a href="/locale/de/formal/wp-themes/twentytwentyfive/">German (Formal)</a>
            </th>
            <td><a href="/projects/wp-themes/twentytwentyfive/de/formal/">100%</a></td>
          </tr>
        </tbody>
      </table>
    `;

    expect(parseProjectLocalesFromHtml(html, 'theme', 'twentytwentyfive')).toEqual([
      { locale: 'nl', label: 'Dutch' },
    ]);
  });
});

describe('buildWordPressTranslationExportUrl', () => {
  it('builds plugin export urls with track', () => {
    expect(
      buildWordPressTranslationExportUrl('plugin', 'admin-site-enhancements', 'nl', 'stable'),
    ).toBe(
      'https://translate.wordpress.org/projects/wp-plugins/admin-site-enhancements/stable/nl/default/export-translations/?format=po',
    );
  });

  it('builds theme export urls', () => {
    expect(buildWordPressTranslationExportUrl('theme', 'twentytwentyfive', 'de-at')).toBe(
      'https://translate.wordpress.org/projects/wp-themes/twentytwentyfive/de-at/default/export-translations/?format=po',
    );
  });
});
