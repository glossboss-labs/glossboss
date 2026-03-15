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

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/auth/callback" element={<Callback />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/explore" element={<Explore />} />

      {/* Public project detail — visibility enforced by RLS + component */}
      <Route path="/projects/:id" element={<ProjectDetail />} />

      {/* Authenticated routes */}
      <Route
        path="/dashboard"
        element={
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <Settings />
          </AuthGuard>
        }
      />
      <Route
        path="/projects/:id/settings"
        element={
          <AuthGuard>
            <ProjectSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/projects/:id/languages/:languageId"
        element={
          <AuthGuard>
            <ProjectEditor />
          </AuthGuard>
        }
      />
      <Route
        path="/orgs/:slug"
        element={
          <AuthGuard>
            <OrgSettings />
          </AuthGuard>
        }
      />
      <Route
        path="/orgs/:slug/settings"
        element={
          <AuthGuard>
            <OrgSettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/invite/:token"
        element={
          <AuthGuard>
            <Invite />
          </AuthGuard>
        }
      />
      <Route
        path="/invite/project/:token"
        element={
          <AuthGuard>
            <ProjectInvite />
          </AuthGuard>
        }
      />
    </Routes>
  );
}
