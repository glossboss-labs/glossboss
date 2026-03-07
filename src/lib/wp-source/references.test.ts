import { buildSvnUrl, buildTracUrl, normalizeSourcePath } from './references';

describe('normalizeSourcePath', () => {
  it('extracts explicit tag base paths', () => {
    expect(normalizeSourcePath('tags/8.4.2/classes/class-admin-columns-manager.php')).toEqual({
      path: 'classes/class-admin-columns-manager.php',
      basePath: 'tags/8.4.2',
    });
  });

  it('strips plugin and wp-content prefixes before base-path detection', () => {
    expect(
      normalizeSourcePath(
        'wp-content/plugins/admin-site-enhancements/trunk/includes/admin/file.php',
        'admin-site-enhancements',
      ),
    ).toEqual({
      path: 'includes/admin/file.php',
      basePath: 'trunk',
    });
  });
});

describe('buildTracUrl', () => {
  it('does not duplicate embedded tag prefixes', () => {
    expect(
      buildTracUrl(
        'admin-site-enhancements',
        'tags/8.4.2/classes/class-admin-columns-manager.php',
        245,
        'tags/8.4.2',
      ),
    ).toBe(
      'https://plugins.trac.wordpress.org/browser/admin-site-enhancements/tags/8.4.2/classes/class-admin-columns-manager.php#L245',
    );
  });
});

describe('buildSvnUrl', () => {
  it('prefers explicit trunk paths from references', () => {
    expect(
      buildSvnUrl(
        'admin-site-enhancements',
        'admin-site-enhancements/trunk/includes/admin/file.php',
        'tags/8.4.2',
      ),
    ).toBe(
      'https://plugins.svn.wordpress.org/admin-site-enhancements/trunk/includes/admin/file.php',
    );
  });
});
