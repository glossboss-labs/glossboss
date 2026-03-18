/**
 * AddLanguageModal — add a language to an existing project.
 *
 * Supports:
 * - Clone from existing language (copies entries with empty translations)
 * - Import from file
 * - Import from WordPress.org (reuses WordPressProjectModal)
 * - Import from repository (reuses RepoSyncModal)
 */

import { useCallback, useRef, useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Select,
  Button,
  Group,
  Paper,
  Text,
  Badge,
  FileButton,
  Alert,
} from '@mantine/core';
import { Upload, Globe, GitBranch, AlertCircle, Copy, Plus } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import type { POFile } from '@/lib/po/types';
import { parseUploadedFile, parseFileContent } from '@/lib/po/parse-file';
import { fetchWordPressTranslationFile } from '@/lib/wp-source';
import type { WordPressProjectOpenRequest } from '@/components/editor/WordPressProjectModal';
import { WordPressProjectModal } from '@/components/editor/WordPressProjectModal';
import { RepoSyncModal } from '@/components/repo-sync/RepoSyncModal';
import { useAddLanguage } from '@/lib/projects/queries';
import { syncProjectEntries } from '@/lib/projects/api';
import type { ProjectLanguageRow } from '@/lib/projects/types';

interface AddLanguageModalProps {
  opened: boolean;
  onClose: () => void;
  projectId: string;
  existingLanguages: ProjectLanguageRow[];
  wpProjectType?: 'plugin' | 'theme' | null;
  wpSlug?: string | null;
  onLanguageAdded: () => void;
}

type SourceType = 'clone' | 'file' | 'wordpress' | 'repo';

export function AddLanguageModal({
  opened,
  onClose,
  projectId,
  existingLanguages,
  onLanguageAdded,
}: AddLanguageModalProps) {
  const { t } = useTranslation();
  const addLanguageMutation = useAddLanguage();
  const fileResetRef = useRef<(() => void) | null>(null);

  const [locale, setLocale] = useState('');
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [cloneSourceId, setCloneSourceId] = useState<string | null>(null);
  const [importedFile, setImportedFile] = useState<POFile | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [wpModalOpen, setWpModalOpen] = useState(false);
  const [repoModalOpen, setRepoModalOpen] = useState(false);
  const [importedFilename, setImportedFilename] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setLocale('');
    setSourceType(null);
    setCloneSourceId(null);
    setImportedFile(null);
    setImportError(null);
    setImporting(false);
    setCreating(false);
    setCreateError(null);
    setWpModalOpen(false);
    setRepoModalOpen(false);
    setImportedFilename(null);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  // ── File upload ────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setImporting(true);
      setImportError(null);

      const outcome = await parseUploadedFile(file);
      if (!outcome.ok) {
        setImportError(outcome.errors[0]?.message ?? t('Failed to parse file'));
        setImporting(false);
        return;
      }

      setImportedFile(outcome.result.file);
      setImportedFilename(file.name);
      setSourceType('file');
      if (!locale && outcome.result.file.header.language) {
        setLocale(outcome.result.file.header.language);
      }
      setImporting(false);
    },
    [locale, t],
  );

  // ── WordPress ──────────────────────────────────────────────

  const handleWordPressProject = useCallback(
    async (request: WordPressProjectOpenRequest) => {
      setWpModalOpen(false);
      setImporting(true);
      setImportError(null);

      try {
        const text = await fetchWordPressTranslationFile({
          projectType: request.projectType,
          slug: request.slug,
          locale: request.locale,
          track: request.track,
        });
        const wpFilename = `${request.slug}-${request.locale.replaceAll('-', '_')}.po`;
        const outcome = parseFileContent(text, wpFilename);

        if (!outcome.ok) {
          setImportError(outcome.errors[0]?.message ?? t('Failed to parse file'));
          setImporting(false);
          return;
        }

        setImportedFile(outcome.result.file);
        setImportedFilename(wpFilename);
        setSourceType('wordpress');
        setLocale(request.locale);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : t('Failed to fetch WordPress file'));
      } finally {
        setImporting(false);
      }
    },
    [t],
  );

  // ── Repository ─────────────────────────────────────────────

  const handleRepoFileLoaded = useCallback(
    (content: string, repoFilename: string) => {
      setRepoModalOpen(false);
      setImportError(null);

      const outcome = parseFileContent(content, repoFilename);
      if (!outcome.ok) {
        setImportError(outcome.errors[0]?.message ?? t('Failed to parse file'));
        return;
      }

      setImportedFile(outcome.result.file);
      setImportedFilename(repoFilename);
      setSourceType('repo');
      if (!locale && outcome.result.file.header.language) {
        setLocale(outcome.result.file.header.language);
      }
    },
    [locale, t],
  );

  // ── Create ─────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!locale.trim()) return;
    setCreating(true);
    setCreateError(null);

    try {
      if (sourceType === 'clone' && cloneSourceId) {
        await addLanguageMutation.mutateAsync({
          projectId,
          languageInsert: {
            project_id: projectId,
            locale: locale.trim(),
            source_filename: null,
            po_header: null,
            wp_locale: null,
            repo_provider: null,
            repo_owner: null,
            repo_name: null,
            repo_branch: null,
            repo_file_path: null,
            repo_default_branch: null,
          },
          sourceLanguageId: cloneSourceId,
        });
      } else if (importedFile) {
        const languageId = await addLanguageMutation.mutateAsync({
          projectId,
          languageInsert: {
            project_id: projectId,
            locale: locale.trim(),
            source_filename: importedFilename,
            po_header: importedFile.header as Record<string, string>,
            wp_locale: null,
            repo_provider: null,
            repo_owner: null,
            repo_name: null,
            repo_branch: null,
            repo_file_path: null,
            repo_default_branch: null,
          },
        });
        // Sync imported entries
        await syncProjectEntries(languageId, projectId, importedFile.entries, new Map(), new Map());
      } else {
        // Empty language
        await addLanguageMutation.mutateAsync({
          projectId,
          languageInsert: {
            project_id: projectId,
            locale: locale.trim(),
            source_filename: null,
            po_header: null,
            wp_locale: null,
            repo_provider: null,
            repo_owner: null,
            repo_name: null,
            repo_branch: null,
            repo_file_path: null,
            repo_default_branch: null,
          },
        });
      }

      handleClose();
      onLanguageAdded();
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t('Failed to add language');
      setCreateError(message);
      setCreating(false);
    }
  }, [
    addLanguageMutation,
    cloneSourceId,
    handleClose,
    importedFile,
    importedFilename,
    locale,
    onLanguageAdded,
    projectId,
    sourceType,
    t,
  ]);

  const cloneOptions = existingLanguages.map((lang) => ({
    value: lang.id,
    label: lang.locale,
  }));

  return (
    <>
      <Modal
        opened={opened && !wpModalOpen && !repoModalOpen}
        onClose={handleClose}
        title={t('Add language')}
        size="lg"
      >
        <Stack gap="md">
          {createError && (
            <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
              {createError}
            </Alert>
          )}

          {importError && (
            <Alert
              icon={<AlertCircle size={16} />}
              color="red"
              variant="light"
              onClose={() => setImportError(null)}
              withCloseButton
            >
              {importError}
            </Alert>
          )}

          <TextInput
            label={t('Locale')}
            placeholder="nl, de, fr-ca"
            value={locale}
            onChange={(e) => setLocale(e.currentTarget.value)}
            required
          />

          <Text size="sm" fw={500}>
            {t('Source')}
          </Text>

          {/* Clone from existing */}
          {existingLanguages.length > 0 && (
            <Paper
              withBorder
              p="md"
              style={{
                borderColor: sourceType === 'clone' ? 'var(--mantine-color-blue-5)' : undefined,
              }}
            >
              <Group justify="space-between" align="center">
                <Group gap="sm">
                  <Copy size={20} />
                  <div>
                    <Text size="sm" fw={500}>
                      {t('Clone from existing language')}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('Copy entries with empty translations')}
                    </Text>
                  </div>
                </Group>
                <Select
                  placeholder={t('Select language')}
                  data={cloneOptions}
                  value={cloneSourceId}
                  onChange={(v) => {
                    setCloneSourceId(v);
                    setSourceType(v ? 'clone' : null);
                    setImportedFile(null);
                  }}
                  size="sm"
                  w={160}
                  clearable
                />
              </Group>
            </Paper>
          )}

          {/* File upload */}
          <Paper
            withBorder
            p="md"
            style={{
              borderColor: sourceType === 'file' ? 'var(--mantine-color-blue-5)' : undefined,
            }}
          >
            <Group justify="space-between" align="center">
              <Group gap="sm">
                <Upload size={20} />
                <Text size="sm" fw={500}>
                  {t('Upload a file')}
                </Text>
              </Group>
              <FileButton
                onChange={(f) => void handleFileUpload(f)}
                accept=".po,.pot,.json"
                resetRef={fileResetRef}
              >
                {(props) => (
                  <Button size="sm" variant="default" loading={importing} {...props}>
                    {t('Browse')}
                  </Button>
                )}
              </FileButton>
            </Group>
            {sourceType === 'file' && importedFilename && (
              <Badge variant="light" size="sm" mt="xs">
                {importedFilename}
              </Badge>
            )}
          </Paper>

          {/* WordPress */}
          <Paper
            withBorder
            p="md"
            style={{
              borderColor: sourceType === 'wordpress' ? 'var(--mantine-color-blue-5)' : undefined,
            }}
          >
            <Group justify="space-between" align="center">
              <Group gap="sm">
                <Globe size={20} />
                <Text size="sm" fw={500}>
                  {t('WordPress.org')}
                </Text>
              </Group>
              <Button
                size="sm"
                variant="default"
                onClick={() => setWpModalOpen(true)}
                loading={importing}
              >
                {t('Select')}
              </Button>
            </Group>
            {sourceType === 'wordpress' && importedFilename && (
              <Badge variant="light" size="sm" mt="xs">
                {importedFilename}
              </Badge>
            )}
          </Paper>

          {/* Repository */}
          <Paper
            withBorder
            p="md"
            style={{
              borderColor: sourceType === 'repo' ? 'var(--mantine-color-blue-5)' : undefined,
            }}
          >
            <Group justify="space-between" align="center">
              <Group gap="sm">
                <GitBranch size={20} />
                <Text size="sm" fw={500}>
                  {t('Repository')}
                </Text>
              </Group>
              <Button
                size="sm"
                variant="default"
                onClick={() => setRepoModalOpen(true)}
                loading={importing}
              >
                {t('Select')}
              </Button>
            </Group>
            {sourceType === 'repo' && importedFilename && (
              <Badge variant="light" size="sm" mt="xs">
                {importedFilename}
              </Badge>
            )}
          </Paper>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleClose}>
              {t('Cancel')}
            </Button>
            <Button
              leftSection={<Plus size={16} />}
              loading={creating}
              onClick={() => void handleCreate()}
              disabled={!locale.trim()}
            >
              {t('Add language')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <WordPressProjectModal
        opened={wpModalOpen}
        onClose={() => setWpModalOpen(false)}
        onOpenProject={handleWordPressProject}
        initialLocale={locale}
      />

      <RepoSyncModal
        opened={repoModalOpen}
        onClose={() => setRepoModalOpen(false)}
        onFileLoaded={handleRepoFileLoaded}
        serializedContent={null}
        initialTab="browse"
      />
    </>
  );
}
