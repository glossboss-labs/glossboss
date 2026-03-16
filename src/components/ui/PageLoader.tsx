/**
 * PageLoader — standardized full-page loading spinner.
 */

import { Center, Loader } from '@mantine/core';

interface PageLoaderProps {
  /** Vertical padding. */
  py?: number;
}

export function PageLoader({ py = 80 }: PageLoaderProps) {
  return (
    <Center py={py}>
      <Loader size="lg" />
    </Center>
  );
}
