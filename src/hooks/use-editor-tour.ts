/**
 * useEditorTour — guided tour of the GlossBoss editor using driver.js.
 *
 * Shows a tooltip-based walkthrough for first-time users. Two modes:
 * - Empty editor: highlights upload options
 * - Loaded editor: walks through the full editing workflow
 *
 * Completion is persisted in localStorage. Re-trigger via the returned
 * `startTour()` callback (wired to the avatar menu and empty state).
 */

import { useCallback, useEffect, useRef } from 'react';
import { driver, type Config, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useTranslation } from '@/lib/app-language';

const TOUR_STORAGE_KEY = 'glossboss-editor-tour-completed';

/** Check if the tour has been completed before. */
function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Mark the tour as completed. */
function markTourCompleted(): void {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
  } catch {
    // localStorage unavailable — ignore
  }
}

/** Reset tour completion (for re-triggering). */
export function resetTourCompletion(): void {
  try {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  } catch {
    // localStorage unavailable — ignore
  }
}

function getEmptySteps(t: (key: string, vars?: Record<string, unknown>) => string): DriveStep[] {
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

function getEditorSteps(t: (key: string, vars?: Record<string, unknown>) => string): DriveStep[] {
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

interface UseEditorTourOptions {
  /** Whether a file is currently loaded in the editor. */
  hasFile: boolean;
  /** Whether to auto-start the tour on first visit. Default: true. */
  autoStart?: boolean;
}

interface UseEditorTourReturn {
  /** Start the tour manually (e.g. from a menu item). */
  startTour: () => void;
  /** Whether the tour has been completed before. */
  completed: boolean;
}

export function useEditorTour({
  hasFile,
  autoStart = true,
}: UseEditorTourOptions): UseEditorTourReturn {
  const { t } = useTranslation();
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const hasAutoStarted = useRef(false);

  const completed = isTourCompleted();

  const startTour = useCallback(() => {
    // Destroy previous instance if any
    if (driverRef.current) {
      driverRef.current.destroy();
    }

    const steps = hasFile ? getEditorSteps(t) : getEmptySteps(t);

    // Filter to only steps whose elements exist in the DOM
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
        markTourCompleted();
        driverRef.current = null;
      },
      steps: availableSteps,
    };

    const d = driver(config);
    driverRef.current = d;
    d.drive();
  }, [hasFile, t]);

  // Auto-start on first visit when the editor is ready
  useEffect(() => {
    if (!autoStart || completed || hasAutoStarted.current) return;

    // Small delay to let the DOM settle after render
    const timer = setTimeout(() => {
      hasAutoStarted.current = true;
      startTour();
    }, 800);

    return () => clearTimeout(timer);
  }, [autoStart, completed, startTour]);

  // Cleanup on unmount
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
