/**
 * ExportSection — project export UI with customizable checkboxes.
 *
 * Renders inside the Settings modal Backup tab. Provides two export modes:
 * 1. Editor snapshot — exports the current editor state (entries + MT + review)
 * 2. Project export — exports a cloud project as a ZIP with selectable contents
 */

import { useCallback, useState } from 'react';
import { Paper, Stack, Text, Button, Checkbox, Alert } from '@mantine/core';
import { Download, Package, AlertCircle, Check } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useEditorStore } from '@/stores/editor-store';
import { exportProject, exportEditorSnapshot } from '@/lib/projects/export';
import type { ProjectExportOptions } from '@/lib/projects/export';

interface ExportSectionProps {
  /** Cloud project ID — null if editing locally */
  projectId?: string | null;
  /** Pre-serialized settings JSON for inclusion in project export */
  settingsJson?: string;
  /** Pre-serialized TM JSON for inclusion in project export */
  translationMemoryJson?: string;
}

export function ExportSection({
  projectId,
  settingsJson,
  translationMemoryJson,
}: ExportSectionProps) {
  const { t } = useTranslation();
  const filename = useEditorStore((s) => s.filename);
  const projectName = useEditorStore((s) => s.projectName);
  const sourceFormat = useEditorStore((s) => s.sourceFormat);
  const header = useEditorStore((s) => s.header);
  const entries = useEditorStore((s) => s.entries);
  const machineTranslationMeta = useEditorStore((s) => s.machineTranslationMeta);
  const reviewEntries = useEditorStore((s) => s.reviewEntries);

  // Export options checkboxes
  const [includeFiles, setIncludeFiles] = useState(true);
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeEditorState, setIncludeEditorState] = useState(true);
  const [includeSettings, setIncludeSettings] = useState(false);
  const [includeTM, setIncludeTM] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // ── Editor snapshot export ──────────────────────────────────

  const handleSnapshotExport = useCallback(() => {
    if (!filename || entries.length === 0) {
      setResult({ success: false, message: t('No file is currently loaded.') });
      return;
    }

    const json = exportEditorSnapshot({
      projectName,
      filename,
      sourceFormat,
      header,
      entries,
      machineTranslationMeta,
      reviewEntries,
    });

    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const safeName = (projectName || filename).replace(/[^\w.-]+/g, '-').toLowerCase();
    anchor.download = `${safeName}-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setResult({ success: true, message: t('Editor snapshot exported.') });
  }, [
    entries,
    filename,
    header,
    machineTranslationMeta,
    projectName,
    reviewEntries,
    sourceFormat,
    t,
  ]);

  // ── Project export ──────────────────────────────────────────

  const handleProjectExport = useCallback(async () => {
    if (!projectId) return;
    setExporting(true);
    setResult(null);

    try {
      const options: ProjectExportOptions = {
        includeTranslationFiles: includeFiles,
        includeMetadata,
        includeEditorState,
        includeSettings: includeSettings && !!settingsJson,
        includeTranslationMemory: includeTM && !!translationMemoryJson,
        settingsJson,
        translationMemoryJson,
      };

      const { blob, filename: zipFilename } = await exportProject(projectId, options);

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = zipFilename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setResult({ success: true, message: t('Project exported successfully.') });
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : t('Failed to export project.'),
      });
    } finally {
      setExporting(false);
    }
  }, [
    includeEditorState,
    includeFiles,
    includeMetadata,
    includeSettings,
    includeTM,
    projectId,
    settingsJson,
    t,
    translationMemoryJson,
  ]);

  const hasFile = !!filename && entries.length > 0;

  return (
    <Stack gap="md">
      {/* Editor snapshot */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <div>
            <Text size="sm" fw={500}>
              {t('Editor snapshot')}
            </Text>
            <Text size="xs" c="dimmed">
              {t(
                'Export the currently open file with full editor state: translations, machine translation metadata, review status, and fuzzy flags.',
              )}
            </Text>
          </div>

          <Button
            leftSection={<Download size={14} />}
            onClick={handleSnapshotExport}
            disabled={!hasFile}
          >
            {t('Export snapshot')}
          </Button>
        </Stack>
      </Paper>

      {/* Project export (cloud projects only) */}
      {projectId && (
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <div>
              <Text size="sm" fw={500}>
                {t('Project export')}
              </Text>
              <Text size="xs" c="dimmed">
                {t('Export the entire cloud project as a ZIP archive. Choose what to include:')}
              </Text>
            </div>

            <Stack gap={6}>
              <Checkbox
                label={t('Translation files (PO/JSON)')}
                checked={includeFiles}
                onChange={(e) => setIncludeFiles(e.currentTarget.checked)}
              />
              <Checkbox
                label={t('Project metadata')}
                checked={includeMetadata}
                onChange={(e) => setIncludeMetadata(e.currentTarget.checked)}
              />
              <Checkbox
                label={t('Editor state (MT metadata, review status)')}
                checked={includeEditorState}
                onChange={(e) => setIncludeEditorState(e.currentTarget.checked)}
              />
              <Checkbox
                label={t('App settings')}
                checked={includeSettings}
                onChange={(e) => setIncludeSettings(e.currentTarget.checked)}
              />
              <Checkbox
                label={t('Translation memory')}
                checked={includeTM}
                onChange={(e) => setIncludeTM(e.currentTarget.checked)}
              />
            </Stack>

            <Button
              leftSection={<Package size={14} />}
              onClick={() => void handleProjectExport()}
              loading={exporting}
              disabled={
                !includeFiles &&
                !includeMetadata &&
                !includeEditorState &&
                !includeSettings &&
                !includeTM
              }
            >
              {t('Export project')}
            </Button>
          </Stack>
        </Paper>
      )}

      {result && (
        <Alert
          color={result.success ? 'green' : 'red'}
          icon={result.success ? <Check size={16} /> : <AlertCircle size={16} />}
        >
          <Text size="sm">{result.message}</Text>
        </Alert>
      )}
    </Stack>
  );
}
