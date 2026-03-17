import { Link } from 'react-router';
import { useComputedColorScheme } from '@mantine/core';
import { useTranslation, msgid, APP_LANGUAGE_OPTIONS, type AppLanguage } from '@/lib/app-language';
import { LanguageSwitcher } from './LanguageSwitcher';

function langHref(lang: string): string {
  return lang === 'en' ? '/' : `/${lang}`;
}

const footerLinks = {
  product: {
    title: msgid('Product'),
    links: [
      { label: msgid('Features'), href: '/#features' },
      { label: msgid('Pricing'), href: '/#pricing' },
      { label: msgid('Roadmap'), href: '/roadmap' },
      { label: msgid('Explore'), href: '/explore' },
    ],
  },
  resources: {
    title: msgid('Resources'),
    links: [
      { label: msgid('Editor'), href: '/editor' },
      { label: 'GitHub', href: 'https://github.com/glossboss-labs/glossboss' },
    ],
  },
  legal: {
    title: msgid('Legal'),
    links: [
      { label: msgid('Privacy'), href: '/privacy' },
      { label: msgid('Terms'), href: '/terms' },
      { label: msgid('License'), href: '/license' },
    ],
  },
};

export function LandingFooter({ currentLang = 'en' }: { currentLang?: AppLanguage }) {
  const { t } = useTranslation();
  const colorScheme = useComputedColorScheme('dark');
  const isDark = colorScheme === 'dark';
  const logo = isDark ? '/glossboss-icon-light.svg' : '/glossboss-icon-dark.svg';

  return (
    <footer className="border-t border-border-subtle px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="GlossBoss" className="h-7 w-7" />
              <span className="text-sm font-semibold text-text-primary">GlossBoss</span>
            </Link>
            <p className="mt-3 text-sm text-text-tertiary">
              {t('The translation platform for teams that ship.')}
            </p>
          </div>

          {/* Link columns */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h4 className="mb-4 text-sm font-semibold text-text-primary">{t(section.title)}</h4>
              <ul className="flex flex-col gap-2.5">
                {section.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith('http') ? (
                      <a
                        href={link.href}
                        className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t(link.label)}
                      </a>
                    ) : link.href.includes('#') ? (
                      <a
                        href={link.href}
                        className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                      >
                        {t(link.label)}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-text-secondary transition-colors hover:text-text-primary"
                      >
                        {t(link.label)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border-subtle pt-8 sm:flex-row sm:items-center">
          <p className="text-sm text-text-tertiary">
            &copy; {new Date().getFullYear()} GlossBoss Labs. {t('All rights reserved.')}
          </p>

          <LanguageSwitcher currentLang={currentLang} size="base" />

          {/* Crawlable language links for SEO (visually hidden) */}
          <nav aria-label="Language" className="sr-only">
            {APP_LANGUAGE_OPTIONS.map((option) => (
              <Link key={option.value} to={langHref(option.value)}>
                {option.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
