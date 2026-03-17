/**
 * ProfileStep — "What should we call you?" display name input.
 * Pre-fills from GitHub profile data when available.
 */

import { useState } from 'react';
import { TextInput, Button, Stack, Title, Text } from '@mantine/core';
import { useTranslation } from '@/lib/app-language';
import { useAuth } from '@/hooks/use-auth';

interface ProfileStepProps {
  onNext: (fullName: string) => void;
}

export function ProfileStep({ onNext }: ProfileStepProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  const prefilled = user?.user_metadata?.full_name || user?.user_metadata?.name || '';
  const [name, setName] = useState(prefilled);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext(name.trim());
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <div className="text-center">
          <Title order={3} fw={700}>
            {t('What should we call you?')}
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            {t('This is how your name will appear to collaborators.')}
          </Text>
        </div>

        <TextInput
          placeholder={t('Your name')}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          autoFocus
          size="md"
          autoComplete="name"
        />

        <Button type="submit" fullWidth size="md">
          {t('Continue')}
        </Button>

        {!name.trim() && (
          <Button variant="subtle" size="xs" fullWidth onClick={() => onNext('')} c="dimmed">
            {t('Skip for now')}
          </Button>
        )}
      </Stack>
    </form>
  );
}
