/**
 * DeepL Module
 * 
 * Client for DeepL translation API via Edge Function.
 */

export * from './types';
export { createDeepLClient, getDeepLClient } from './client';
export { 
  getDeepLSettings, 
  saveDeepLSettings, 
  clearDeepLSettings, 
  hasUserApiKey,
  getDeepLApiUrl,
  type DeepLSettings,
  type DeepLApiType,
} from './settings';
