/**
 * Projects Module
 *
 * Cloud project management: CRUD, sync, and type conversions.
 */

export type {
  ProjectRow,
  ProjectInsert,
  ProjectUpdate,
  ProjectEntryRow,
  ProjectEntryInsert,
  ProjectMemberRow,
  ProjectLanguageRow,
  ProjectLanguageInsert,
  ProjectLanguageUpdate,
  ProjectWithLanguages,
} from './types';

export {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectLanguages,
  getProjectLanguage,
  createProjectLanguage,
  updateProjectLanguage,
  deleteProjectLanguage,
  cloneLanguageEntries,
  getProjectEntries,
  getProjectEntryKeys,
  syncProjectEntries,
} from './api';

export {
  dbEntryToPOEntry,
  dbEntryToMTMeta,
  dbEntryToReviewState,
  dbLanguageToHeader,
  dbProjectToHeader,
  entryKey,
  poEntryToDbFields,
  editorStateToProjectUpdate,
  editorStateToLanguageUpdate,
} from './conversions';
