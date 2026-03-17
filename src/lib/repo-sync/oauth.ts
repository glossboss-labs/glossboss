/**
 * Repository OAuth Flow
 *
 * Opens a popup to the repo-oauth edge function which handles the
 * GitHub/GitLab OAuth authorization flow. On success, the edge function
 * redirects the popup back to our origin with the token in the URL hash
 * fragment (never sent to any server). We poll the popup's URL to detect
 * the redirect and extract the token.
 */

import type { RepoProviderId } from './types';

const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;
const POPUP_TIMEOUT_MS = 120_000; // 2 minutes

interface OAuthResult {
  provider: RepoProviderId;
  token: string;
}

/**
 * Start the OAuth flow for the given provider.
 * Opens a popup and returns a promise that resolves with the access token.
 */
export function startRepoOAuth(provider: RepoProviderId): Promise<OAuthResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    return Promise.reject(new Error('VITE_SUPABASE_URL is not configured'));
  }

  const functionUrl = `${supabaseUrl}/functions/v1/repo-oauth`;
  const origin = window.location.origin;
  const url = `${functionUrl}?provider=${provider}&origin=${encodeURIComponent(origin)}`;

  return new Promise<OAuthResult>((resolve, reject) => {
    // Center the popup on screen
    const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);
    const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},popup=yes`;

    const popup = window.open(url, 'glossboss-repo-oauth', features);
    if (!popup) {
      reject(new Error('Popup was blocked by the browser. Please allow popups for this site.'));
      return;
    }

    let settled = false;

    const cleanup = () => {
      clearTimeout(timeoutId);
      clearInterval(pollId);
    };

    // Poll the popup URL — once it redirects back to our origin,
    // we can read the hash fragment containing the token.
    const pollId = setInterval(() => {
      if (settled) return;

      try {
        // This throws while the popup is on a different origin (expected)
        const popupUrl = popup.location.href;

        // If we can read it, the popup is back on our origin
        if (popupUrl.startsWith(origin)) {
          const hash = popup.location.hash;
          const params = new URLSearchParams(hash.replace(/^#/, ''));

          const token = params.get('repo-oauth-token');
          const oauthProvider = params.get('repo-oauth-provider') as RepoProviderId | null;
          const error = params.get('repo-oauth-error');

          settled = true;
          cleanup();

          try {
            popup.close();
          } catch {
            // ignore
          }

          if (error) {
            reject(new Error(error));
          } else if (token && oauthProvider) {
            resolve({ provider: oauthProvider, token });
          } else {
            reject(new Error('OAuth callback missing token'));
          }
        }
      } catch {
        // Cross-origin — popup is still on GitHub/GitLab/Supabase, keep polling
      }

      // Detect popup closed without completing
      if (!settled && popup.closed) {
        settled = true;
        cleanup();
        reject(new Error('OAuth flow was cancelled'));
      }
    }, 300);

    // Timeout if the user doesn't complete the flow
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        try {
          popup.close();
        } catch {
          // popup may already be closed
        }
        reject(new Error('OAuth flow timed out'));
      }
    }, POPUP_TIMEOUT_MS);
  });
}
