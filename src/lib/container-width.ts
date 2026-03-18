import { CONTAINER_WIDTH_KEY as _CONTAINER_WIDTH_KEY } from '@/lib/constants/storage-keys';

/** localStorage key for persisting the container width preference */
export const CONTAINER_WIDTH_KEY = _CONTAINER_WIDTH_KEY;

/** Available container width options */
export const CONTAINER_WIDTH_OPTIONS = [
  { value: 'md', label: 'Medium (980px)' },
  { value: 'lg', label: 'Large (1120px)' },
  { value: 'xl', label: 'Extra large (1320px)' },
  { value: '100%', label: 'Full width' },
] as const;

/** Union type of valid container width values */
export type ContainerWidth = (typeof CONTAINER_WIDTH_OPTIONS)[number]['value'];
