/**
 * PageError — standardized error alert for page-level errors.
 */

import { Alert, Text } from '@mantine/core';
import { AlertCircle } from 'lucide-react';

interface PageErrorProps {
  /** Error message to display. */
  message: string;
}

export function PageError({ message }: PageErrorProps) {
  return (
    <Alert icon={<AlertCircle size={16} />} color="red" variant="light">
      <Text size="sm">{message}</Text>
    </Alert>
  );
}
