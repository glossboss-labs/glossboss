/**
 * Guided tour hooks using driver.js.
 *
 * Three tours:
 * - Empty editor: highlights upload options for first-time visitors
 * - Loaded editor: walks through the full editing workflow
 * - Settings: guides users through translation provider setup
 *
 * Each tour has its own localStorage key. Re-trigger via the returned
 * `startTour()` callback or by navigating with ?tour=1 / ?tour=settings.
 */

import { useCallback, useEffect, useRef } from 'react';
import { driver, type Config, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTranslation } from '@/lib/app-language';

/* ------------------------------------------------------------------ */
/*  Persistence helpers                                                */
/* ------------------------------------------------------------------ */

function isTourDone(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markTourDone(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // localStorage unavailable
  }
}

/** Reset one or all tour completion flags. */
export function resetTourCompletion(key?: string): void {
  try {
    if (key) {
      localStorage.removeItem(key);
    } else {
      localStorage.removeItem(EDITOR_TOUR_KEY);
      localStorage.removeItem(SETTINGS_TOUR_KEY);
    }
  } catch {
    // localStorage unavailable
  }
}

const EDITOR_TOUR_KEY = 'glossboss-editor-tour-completed';
const SETTINGS_TOUR_KEY = 'glossboss-settings-tour-completed';

/* ------------------------------------------------------------------ */
/*  Step definitions                                                   */
/* ------------------------------------------------------------------ */

type T = (key: string, vars?: Record<string, unknown>) => string;

function getEmptySteps(t: T): DriveStep[] {
  return [
    {
      element: '[data-tour="upload-area"]',
      popover: {
        title: t('Upload a file'),
        description: t(
          'Start by uploading a .po, .pot, or .json translation file. Drag and drop or click to browse.',
        ),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="url-input"]',
      popover: {
        title: t('Load from URL'),
        description: t('Paste a direct link to a translation file to load it instantly.'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="quick-open"]',
      popover: {
        title: t('Quick open'),
        description: t(
          'Import from WordPress.org, connect a GitHub or GitLab repository, or try a sample file.',
        ),
        side: 'top',
        align: 'center',
      },
    },
  ];
}

function getEditorSteps(t: T): DriveStep[] {
  return [
    {
      element: '[data-tour="file-menu"]',
      popover: {
        title: t('File menu'),
        description: t(
          'Upload files, download translations, update from a POT template, and manage backups.',
        ),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="language-selectors"]',
      popover: {
        title: t('Language settings'),
        description: t('Set your source and target languages for translation.'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="bulk-translate"]',
      popover: {
        title: t('AI translation'),
        description: t('Translate all untranslated entries at once with DeepL, Azure, or Gemini.'),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="filter-toolbar"]',
      popover: {
        title: t('Search and filter'),
        description: t(
          'Search entries by source text, translation, or context. Filter by status: untranslated, fuzzy, translated.',
        ),
        side: 'bottom',
        align: 'center',
      },
    },
    {
      element: '[data-tour="workspace-mode"]',
      popover: {
        title: t('Edit and review'),
        description: t(
          'Switch between editing translations and reviewing them with approval workflows.',
        ),
        side: 'bottom',
        align: 'end',
      },
    },
    {
      element: '[data-tour="editor-table"]',
      popover: {
        title: t('Translation table'),
        description: t(
          'Click any cell to edit your translation. Use the translate button on each row for single-entry AI translation.',
        ),
        side: 'top',
        align: 'center',
      },
    },
  ];
}

function getSettingsSteps(t: T): DriveStep[] {
  return [
    {
      element: '[data-tour="settings-tabs"]',
      popover: {
        title: t('Settings tabs'),
        description: t(
          'All your preferences in one place. Start with Translation to set up AI-powered translation.',
        ),
        side: 'right',
        align: 'start',
      },
    },
    {
      element: '[data-tour="settings-provider"]',
      popover: {
        title: t('Choose a provider'),
        description: t(
          'Pick DeepL, Azure Translator, or Google Gemini. Each has a free tier — bring your own API key.',
        ),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="settings-api-key"]',
      popover: {
        title: t('Enter your API key'),
        description: t(
          'Paste your provider API key here. Use "Test connection" to verify it works.',
        ),
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: '[data-tour="settings-glossary-tab"]',
      popover: {
        title: t('Glossary settings'),
        description: t(
          'Load glossaries to enforce consistent terminology across all translations.',
        ),
        side: 'right',
        align: 'center',
      },
    },
    {
      element: '[data-tour="settings-display-tab"]',
      popover: {
        title: t('Display preferences'),
        description: t(
          'Customize the editor layout: container width, visible columns, and navigation behavior.',
        ),
        side: 'right',
        align: 'center',
      },
    },
    {
      element: '[data-tour="settings-backup-tab"]',
      popover: {
        title: t('Backup and restore'),
        description: t(
          'Export your settings as a JSON file or import from a backup. Manage translation memory here.',
        ),
        side: 'right',
        align: 'center',
      },
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Generic tour runner                                                */
/* ------------------------------------------------------------------ */

function runTour(
  steps: DriveStep[],
  storageKey: string,
  t: T,
  driverRef: React.MutableRefObject<ReturnType<typeof driver> | null>,
): void {
  if (driverRef.current) {
    driverRef.current.destroy();
  }

  const availableSteps = steps.filter((step) => {
    if (!step.element) return true;
    const selector = typeof step.element === 'string' ? step.element : null;
    return selector ? document.querySelector(selector) !== null : true;
  });

  if (availableSteps.length === 0) return;

  const config: Config = {
    showProgress: true,
    animate: true,
    smoothScroll: true,
    allowClose: true,
    stagePadding: 8,
    stageRadius: 8,
    popoverOffset: 12,
    nextBtnText: t('Next'),
    prevBtnText: t('Back'),
    doneBtnText: t('Done'),
    progressText: t('Step {{current}} of {{total}}'),
    onDestroyed: () => {
      markTourDone(storageKey);
      driverRef.current = null;
    },
    steps: availableSteps,
  };

  const d = driver(config);
  driverRef.current = d;
  d.drive();
}

/* ------------------------------------------------------------------ */
/*  useEditorTour                                                      */
/* ------------------------------------------------------------------ */

interface UseEditorTourOptions {
  hasFile: boolean;
  autoStart?: boolean;
}

interface UseTourReturn {
  startTour: () => void;
  completed: boolean;
}

export function useEditorTour({ hasFile, autoStart = true }: UseEditorTourOptions): UseTourReturn {
  const { t } = useTranslation();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const hasAutoStarted = useRef(false);
  const completed = isTourDone(EDITOR_TOUR_KEY);

  const startTour = useCallback(() => {
    const steps = hasFile ? getEditorSteps(t) : getEmptySteps(t);
    runTour(steps, EDITOR_TOUR_KEY, t, driverRef);
  }, [hasFile, t]);

  useEffect(() => {
    if (!autoStart || completed || hasAutoStarted.current) return;
    const timer = setTimeout(() => {
      hasAutoStarted.current = true;
      startTour();
    }, 800);
    return () => clearTimeout(timer);
  }, [autoStart, completed, startTour]);

  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, []);

  return { startTour, completed };
}

/* ------------------------------------------------------------------ */
/*  useSettingsTour                                                     */
/* ------------------------------------------------------------------ */

interface UseSettingsTourOptions {
  autoStart?: boolean;
}

export function useSettingsTour({ autoStart = true }: UseSettingsTourOptions = {}): UseTourReturn {
  const { t } = useTranslation();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const hasAutoStarted = useRef(false);
  const completed = isTourDone(SETTINGS_TOUR_KEY);

  const startTour = useCallback(() => {
    runTour(getSettingsSteps(t), SETTINGS_TOUR_KEY, t, driverRef);
  }, [t]);

  useEffect(() => {
    if (!autoStart || completed || hasAutoStarted.current) return;
    const timer = setTimeout(() => {
      hasAutoStarted.current = true;
      startTour();
    }, 600);
    return () => clearTimeout(timer);
  }, [autoStart, completed, startTour]);

  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, []);

  return { startTour, completed };
}
