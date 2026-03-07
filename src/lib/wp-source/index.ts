/**
 * WordPress Plugin Source Code Integration
 *
 * Tools for viewing plugin source code from plugins.trac.wordpress.org.
 */

export {
  parseReference,
  parseReferences,
  normalizeSourcePath,
  detectPluginSlug,
  buildTracUrl,
  buildSvnUrl,
  type ParsedReference,
  type NormalizedSourcePath,
  type DetectedPlugin,
} from './references';

export {
  fetchSourceFile,
  fetchDirectoryListing,
  clearCache,
  validateSlug,
  type DirectoryEntry,
  type FetchSourceResult,
  type FetchDirResult,
} from './fetcher';
