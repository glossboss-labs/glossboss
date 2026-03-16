/**
 * DataExportSection — GDPR Article 20 data portability UI.
 * Placed in the Account settings tab.
 */

import { useState, useCallback } from 'react';
import { Stack, Text, Paper, Button, Alert, Group } from '@mantine/core';
import { Download, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import { useAuth } from '@/hooks/use-auth';
import { invokeSupabaseFunction, readSupabaseFunctionError } from '@/lib/supabase/client';

export function DataExportSection() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setResult(null);

    try {
      const {
        data,
        error: invokeError,
        response,
      } = await invokeSupabaseFunction<{
        ok: boolean;
        data?: Record<string, unknown>;
        message?: string;
      }>('account-export', {
        featureLabel: 'Data export',
        method: 'POST',
        body: {},
      });

      if (invokeError || !data?.ok) {
        const errorBody = await readSupabaseFunctionError(response);
        setResult({
          success: false,
          message: (errorBody.message as string) || t('Data export failed. Please try again.'),
        });
        setExporting(false);
        return;
      }

      // Download the data as a JSON file
      const exportData = data.data;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `glossboss-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setResult({ success: true, message: t('Data exported successfully.') });
    } catch {
      setResult({
        success: false,
        message: t('Data export failed. Please try again.'),
      });
    } finally {
      setExporting(false);
    }
  }, [t]);

  if (!user) return null;

  return (
    <Paper p="md" withBorder>
      <Stack gap="sm">
        <Text size="sm" fw={500}>
          {t('Export your data')}
        </Text>
        <Text size="xs" c="dimmed">
          {t(
            'Download a copy of all your data as a JSON file. This includes your profile, projects, translations, organization memberships, subscriptions, and notifications.',
          )}
        </Text>
        <Group>
          <Button
            variant="light"
            leftSection={<Download size={14} />}
            onClick={handleExport}
            loading={exporting}
          >
            {t('Export my data')}
          </Button>
        </Group>
        {result && (
          <Alert
            color={result.success ? 'green' : 'red'}
            icon={result.success ? <Check size={16} /> : <AlertCircle size={16} />}
          >
            <Text size="sm">{result.message}</Text>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
