/**
 * CreateOrgModal — create a new organization.
 */

import { useState } from 'react';
import { Modal, Stack, TextInput, Textarea, Button, Alert } from '@mantine/core';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useOrganizationsStore } from '@/stores/organizations-store';
import { useAuth } from '@/hooks/use-auth';

interface CreateOrgModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated?: (orgId: string) => void;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

export function CreateOrgModal({ opened, onClose, onCreated }: CreateOrgModalProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const createOrganization = useOrganizationsStore((s) => s.createOrganization);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugTouched) {
      setSlug(toSlug(val));
    }
  };

  const handleSlugChange = (val: string) => {
    setSlugTouched(true);
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim() || !user) return;

    setLoading(true);
    setError(null);

    try {
      const org = await createOrganization({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        avatar_url: null,
        owner_id: user.id,
      });
      setName('');
      setSlug('');
      setSlugTouched(false);
      setDescription('');
      onClose();
      onCreated?.(org.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Failed to create organization'));
    } finally {
      setLoading(false);
    }
  };

  const slugValid = slug.length >= 2 && /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug);

  return (
    <Modal opened={opened} onClose={onClose} title={t('Create organization')} size="md">
      <Stack gap="md">
        {error && (
          <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <TextInput
          label={t('Organization name')}
          placeholder={t('My Team')}
          value={name}
          onChange={(e) => handleNameChange(e.currentTarget.value)}
          required
        />

        <TextInput
          label={t('Slug')}
          description={t('URL-safe identifier (lowercase, numbers, hyphens)')}
          placeholder="my-team"
          value={slug}
          onChange={(e) => handleSlugChange(e.currentTarget.value)}
          error={
            slug.length > 0 && !slugValid
              ? t('Must be 2–63 chars, lowercase alphanumeric and hyphens')
              : undefined
          }
          required
        />

        <Textarea
          label={t('Description')}
          placeholder={t('Optional description')}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={4}
        />

        <Button
          onClick={handleCreate}
          loading={loading}
          disabled={!name.trim() || !slugValid}
          fullWidth
        >
          {t('Create organization')}
        </Button>
      </Stack>
    </Modal>
  );
}
