/**
 * ⚠️ ROUTING RULES:
 * - Router is in main.tsx. Do NOT add another <BrowserRouter> here or anywhere.
 * - Use <Routes> + <Route> components ONLY. Do NOT use useRoutes().
 * - STATIC IMPORTS ONLY — no React.lazy() or dynamic import().
 * - Import from 'react-router' — NOT 'react-router-dom' (does not exist).
 */
import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router';
import { trackPageView } from '@/lib/analytics';
import LandingGuard from '@/pages/LandingGuard';
import { APP_LANGUAGE_OPTIONS } from '@/lib/app-language';
import Index from '@/pages/Index';
import Dashboard from '@/pages/Dashboard';
import Explore from '@/pages/Explore';
import Roadmap from '@/pages/Roadmap';
import ProjectDetail from '@/pages/ProjectDetail';
import ProjectEditor from '@/pages/ProjectEditor';
import OrgSettings from '@/pages/OrgSettings';
import Settings from '@/pages/Settings';
import ProjectSettings from '@/pages/ProjectSettings';
import OrgSettingsPage from '@/pages/OrgSettingsPage';
import Invite from '@/pages/Invite';
import ProjectInvite from '@/pages/ProjectInvite';
import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';
import Callback from '@/pages/auth/Callback';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import ResetPassword from '@/pages/auth/ResetPassword';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { CloudAppShell } from '@/components/AppShell';

export default function App() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <Routes>
      {/* Landing page (full-bleed, no shell) — redirects authed users to /dashboard */}
      <Route path="/" element={<LandingGuard />} />
      {/* Language-specific landing pages — one route per discovered PO locale (except en which is /) */}
      {APP_LANGUAGE_OPTIONS.filter((o) => o.value !== 'en').map((o) => (
        <Route key={o.value} path={`/${o.value}`} element={<LandingGuard lang={o.value} />} />
      ))}

      {/* Auth routes (no shell) */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/callback" element={<Callback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Authenticated pages with sidebar shell */}
      <Route
        element={
          <AuthGuard>
            <CloudAppShell />
          </AuthGuard>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects/:id/settings" element={<ProjectSettings />} />
        <Route path="/projects/:id/languages/:languageId" element={<ProjectEditor />} />
        <Route path="/orgs/:slug" element={<OrgSettings />} />
        <Route path="/orgs/:slug/settings" element={<OrgSettingsPage />} />
        <Route path="/invite/:token" element={<Invite />} />
        <Route path="/invite/project/:token" element={<ProjectInvite />} />
      </Route>

      {/* Public pages with sidebar shell (no auth guard) */}
      <Route element={<CloudAppShell />}>
        <Route path="/settings" element={<Settings />} />
        <Route path="/editor" element={<Index />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
      </Route>
    </Routes>
  );
}
