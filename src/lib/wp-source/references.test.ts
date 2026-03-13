import {
  buildSvnUrl,
  buildTracUrl,
  detectWordPressProject,
  normalizeSourcePath,
} from './references';

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
        'plugin',
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
        'plugin',
        'admin-site-enhancements',
        'admin-site-enhancements/trunk/includes/admin/file.php',
        'tags/8.4.2',
      ),
    ).toBe(
      'https://plugins.svn.wordpress.org/admin-site-enhancements/trunk/includes/admin/file.php',
    );
  });

  it('builds theme SVN URLs with version base paths', () => {
    expect(buildSvnUrl('theme', 'twentytwentyfive', 'patterns/footer.php', '1.4')).toBe(
      'https://themes.svn.wordpress.org/twentytwentyfive/1.4/patterns/footer.php',
    );
  });
});

describe('detectWordPressProject', () => {
  it('detects theme projects from support URLs', () => {
    expect(
      detectWordPressProject(
        {
          reportMsgidBugsTo: 'https://wordpress.org/support/theme/twentytwentyfive/',
          projectIdVersion: 'Twenty Twenty-Five 1.4',
        },
        'twentytwentyfive-nl_NL.po',
      ),
    ).toEqual({
      type: 'theme',
      slug: 'twentytwentyfive',
      version: '1.4',
    });
  });
});
