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
    { label: t('Pricing'), href: '/#pricing' },
    { label: t('Roadmap'), href: '/roadmap' },
    { label: t('Explore'), href: '/explore' },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border-subtle bg-surface-0/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center">
          <img src={logo} alt="GlossBoss" className="h-7" />
        </Link>

        {/* Desktop nav */}
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
        <div className="hidden items-center gap-4 md:flex">
          <LanguageSwitcher currentLang={currentLang} size="sm" />
          <button
            onClick={toggleColorScheme}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
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
          className="flex items-center md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
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
                <LanguageSwitcher currentLang={currentLang} />
                <button
                  onClick={toggleColorScheme}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-2"
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
