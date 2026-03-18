import { use } from 'react';
import { TranslationContext } from './translation-context';

export function useTranslation() {
  return use(TranslationContext);
}
