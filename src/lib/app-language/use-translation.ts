import { useContext } from 'react';
import { TranslationContext } from './translation-context';

export function useTranslation() {
  return useContext(TranslationContext);
}
