/**
 * Derived project accessors.
 *
 * Pure helpers that resolve the effective slug, project type, and release from
 * the source store state.  Extracted from the store module so they can be
 * imported and tested without pulling in Zustand.
 */

import type { WordPressProjectType, WordPressPluginTranslationTrack } from './references';

/** Minimal state shape consumed by the helpers. */
export interface EffectiveProjectState {
  projectType: WordPressProjectType | null;
  projectSlug: string | null;
  autoDetectedProjectType: WordPressProjectType | null;
  autoDetectedSlug: string | null;
  projectVersion: string | null;
  selectedRelease: string | null;
  pluginTranslationTrack: WordPressPluginTranslationTrack;
}

export function getEffectiveSlug(state: EffectiveProjectState): string | null {
  return state.projectSlug || state.autoDetectedSlug;
}

export function getEffectiveProjectType(state: EffectiveProjectState): WordPressProjectType | null {
  return state.projectType || state.autoDetectedProjectType;
}

export function getEffectiveRelease(state: EffectiveProjectState): string | null {
  if (getEffectiveProjectType(state) === 'plugin' && state.pluginTranslationTrack === 'dev') {
    return null;
  }
  return state.selectedRelease ?? state.projectVersion;
}
