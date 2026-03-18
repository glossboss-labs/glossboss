/**
 * Project visibility constants — icons and translatable labels.
 */

import { Lock, Globe, EyeOff } from 'lucide-react';
import { msgid } from '@/lib/app-language';

export const VISIBILITY_ICON = {
  private: Lock,
  public: Globe,
  unlisted: EyeOff,
} as const;

export const VISIBILITY_LABEL: Record<string, string> = {
  private: msgid('Private'),
  public: msgid('Public'),
  unlisted: msgid('Unlisted'),
};
