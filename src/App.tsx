/**
 * ⚠️ ROUTING RULES:
 * - Router is in main.tsx. Do NOT add another <BrowserRouter> here or anywhere.
 * - Use <Routes> + <Route> components ONLY. Do NOT use useRoutes().
 * - STATIC IMPORTS ONLY — no React.lazy() or dynamic import().
 * - Import from 'react-router' — NOT 'react-router-dom' (does not exist).
 */
import { Routes, Route } from 'react-router';
import Index from '@/pages/Index';
import Dashboard from '@/pages/Dashboard';
import Explore from '@/pages/Explore';
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
  return (
    <Routes>
      {/* Public routes (no shell) */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/callback" element={<Callback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Full-width editor (no sidebar) */}
      <Route
        path="/projects/:id/languages/:languageId"
        element={
          <AuthGuard>
            <ProjectEditor />
          </AuthGuard>
        }
      />

      {/* Cloud pages with sidebar shell */}
      <Route
        element={
          <AuthGuard>
            <CloudAppShell />
          </AuthGuard>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/projects/:id/settings" element={<ProjectSettings />} />
        <Route path="/orgs/:slug" element={<OrgSettings />} />
        <Route path="/orgs/:slug/settings" element={<OrgSettingsPage />} />
        <Route path="/invite/:token" element={<Invite />} />
        <Route path="/invite/project/:token" element={<ProjectInvite />} />
      </Route>

      {/* Public pages with sidebar shell (no auth guard) */}
      <Route element={<CloudAppShell />}>
        <Route path="/explore" element={<Explore />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
      </Route>
    </Routes>
  );
}
