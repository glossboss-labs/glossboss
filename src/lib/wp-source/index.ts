/**
 * WordPress Plugin Source Code Integration
 *
 * Tools for viewing plugin source code from plugins.trac.wordpress.org.
 */

export {
  parseReference,
  parseReferences,
  detectPluginSlug,
  buildTracUrl,
  buildSvnUrl,
  type ParsedReference,
} from './references';

export {
  fetchSourceFile,
  fetchDirectoryListing,
  clearCache,
  validateSlug,
  type DirectoryEntry,
} from './fetcher';
