import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/geist';
import App from './App';
import { AppProviders } from './providers';
import { LocalStorageAdapter, setStorageAdapter } from '@/lib/cloud';
import { initPostHog } from '@/lib/analytics';
import { isPostHogEnabled } from '@/lib/analytics/posthog';
import './index.css';

/** Initialize the default storage adapter before the app renders */
setStorageAdapter(new LocalStorageAdapter());

/** Initialize analytics (no-op when VITE_POSTHOG_KEY is unset) */
if (isPostHogEnabled()) {
  void initPostHog();
}

/**
 * ⚠️ ROUTER LIVES HERE — Do NOT add <BrowserRouter>, <Router>, or <MemoryRouter> anywhere else.
 * All route definitions go in App.tsx using <Routes> and <Route>.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
);
