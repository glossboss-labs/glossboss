/**
 * ⚠️ ROUTING RULES:
 * - Router is in main.tsx. Do NOT add another <BrowserRouter> here or anywhere.
 * - Use <Routes> + <Route> components ONLY. Do NOT use useRoutes().
 * - React.lazy() calls MUST be at module scope (React 19 requirement).
 * - Import from 'react-router' — NOT 'react-router-dom' (does not exist).
 */
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router';
import { trackPageView } from '@/lib/analytics';
import { APP_LANGUAGE_OPTIONS } from '@/lib/app-language';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { OnboardingGuard } from '@/components/auth/OnboardingGuard';
import { CloudAppShell } from '@/components/AppShell';
import { PageLoader } from '@/components/ui';

// First-paint routes — eagerly loaded
import LandingGuard from '@/pages/LandingGuard';
import Login from '@/pages/auth/Login';
import Signup from '@/pages/auth/Signup';

// Lazy-loaded routes
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Explore = lazy(() => import('@/pages/Explore'));
const Roadmap = lazy(() => import('@/pages/Roadmap'));
const ProjectDetail = lazy(() => import('@/pages/ProjectDetail'));
const ProjectEditor = lazy(() => import('@/pages/ProjectEditor'));
const ProjectSettings = lazy(() => import('@/pages/ProjectSettings'));
const OrgSettings = lazy(() => import('@/pages/OrgSettings'));
const OrgSettingsPage = lazy(() => import('@/pages/OrgSettingsPage'));
const Settings = lazy(() => import('@/pages/Settings'));
const Index = lazy(() => import('@/pages/Index'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const Invite = lazy(() => import('@/pages/Invite'));
const ProjectInvite = lazy(() => import('@/pages/ProjectInvite'));
const LicensePage = lazy(() => import('@/pages/LicensePage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const Callback = lazy(() => import('@/pages/auth/Callback'));
const Onboarding = lazy(() => import('@/pages/auth/Onboarding'));
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'));

export default function App() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Landing page (full-bleed, no shell) — shows Dashboard link when authed */}
        <Route path="/" element={<LandingGuard />} />
        {/* Language-specific landing pages — one route per discovered PO locale (except en which is /) */}
        {APP_LANGUAGE_OPTIONS.filter((o) => o.value !== 'en').map((o) => (
          <Route key={o.value} path={`/${o.value}`} element={<LandingGuard lang={o.value} />} />
        ))}

        {/* Legal pages (full-bleed, no shell — same look as landing) */}
        <Route path="/license" element={<LicensePage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* Auth routes (no shell) */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/callback" element={<Callback />} />
        <Route
          path="/onboarding"
          element={
            <OnboardingGuard>
              <Onboarding />
            </OnboardingGuard>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* All sidebar pages share a single CloudAppShell to prevent sidebar remounting */}
        <Route element={<CloudAppShell />}>
          {/* Authenticated pages */}
          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Dashboard />
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

          {/* Public pages */}
          <Route path="/settings" element={<Settings />} />
          <Route path="/editor" element={<Index />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
