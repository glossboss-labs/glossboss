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
  detectWordPressProject,
  buildTracUrl,
  buildSvnUrl,
  type WordPressProjectType,
  type WordPressPluginTranslationTrack,
  type ParsedReference,
  type NormalizedSourcePath,
  type DetectedWordPressProject,
} from './references';

export {
  fetchSourceFile,
  fetchDirectoryListing,
  fetchProjectReleases,
  clearCache,
  validateWordPressProject,
  type DirectoryEntry,
  type FetchSourceResult,
  type FetchDirResult,
} from './fetcher';

export {
  buildWordPressReleaseList,
  buildWordPressTranslationExportUrl,
  fetchWordPressProjectInfo,
  fetchWordPressTranslationFile,
  sortWordPressReleases,
  validateWordPressProjectSlug,
  type WordPressProjectInfo,
} from './project';

export { fetchUpstreamTemplate, type UpstreamTemplate } from './upstream';

export {
  diffEntriesAgainstTemplate,
  type ReleaseDeltaKind,
  type ReleaseDiffResult,
  type ReleaseDiffSummary,
} from './diff';
