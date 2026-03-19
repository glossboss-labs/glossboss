import { useState } from 'react';
import { Link } from 'react-router';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useTranslation, type AppLanguage } from '@/lib/app-language';
import { LanguageSwitcher } from './LanguageSwitcher';

export function LandingNav({
  currentLang = 'en',
  isAuthenticated,
}: {
  currentLang?: AppLanguage;
  isAuthenticated?: boolean;
}) {
  const { t } = useTranslation();
  const computedScheme = useComputedColorScheme('dark');
  const { toggleColorScheme } = useMantineColorScheme();
  const isDark = computedScheme === 'dark';
  const [mobileOpen, setMobileOpen] = useState(false);

  const logo = isDark ? '/glossboss-combined-light.svg' : '/glossboss-combined-dark.svg';

  const navLinks = [
    { label: t('Features'), href: '/#features' },
    { label: t('Pricing'), href: '/pricing' },
    { label: t('Roadmap'), href: '/roadmap' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border-subtle bg-surface-0/80 backdrop-blur-lg">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-6">
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center">
          <img src={logo} alt="GlossBoss" className="h-7" />
        </Link>

        {/* Desktop nav — centered on the page */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) =>
            link.href.includes('#') ? (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                to={link.href}
                className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                {link.label}
              </Link>
            ),
          )}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center justify-end gap-4 md:flex">
          <LanguageSwitcher currentLang={currentLang} size="sm" />
          <button
            onClick={toggleColorScheme}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            aria-label={isDark ? t('Switch to light mode') : t('Switch to dark mode')}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="rounded-md bg-text-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
            >
              {t('Dashboard')}
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                {t('Sign in')}
              </Link>
              <Link
                to="/signup"
                className="rounded-md bg-text-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
              >
                {t('Get started free')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="flex items-center justify-self-end md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={t('Toggle menu')}
        >
          {mobileOpen ? (
            <X size={20} className="text-text-primary" />
          ) : (
            <Menu size={20} className="text-text-primary" />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border-subtle bg-surface-0 px-6 pb-6 md:hidden">
          <div className="flex flex-col gap-4 pt-4">
            {navLinks.map((link) =>
              link.href.includes('#') ? (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ),
            )}
            <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
              <div className="flex items-center gap-3">
                <LanguageSwitcher currentLang={currentLang} align="start" />
                <button
                  type="button"
                  onClick={toggleColorScheme}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-2"
                  aria-label={isDark ? t('Switch to light mode') : t('Switch to dark mode')}
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  className="rounded-md bg-text-primary px-4 py-2.5 text-center text-sm font-medium text-surface-0"
                >
                  {t('Dashboard')}
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-medium text-text-secondary">
                    {t('Sign in')}
                  </Link>
                  <Link
                    to="/signup"
                    className="rounded-md bg-text-primary px-4 py-2.5 text-center text-sm font-medium text-surface-0"
                  >
                    {t('Get started free')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
