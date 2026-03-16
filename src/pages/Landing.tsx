import { useEffect } from 'react';
import { APP_LANGUAGE_OPTIONS, type AppLanguage } from '@/lib/app-language';
import {
  EarlyBetaBanner,
  LandingNav,
  HeroSection,
  ProductShowcase,
  SocialProofBar,
  HowItWorks,
  FeatureGrid,
  FormatSection,
  OpenSourceSection,
  PricingSection,
  FAQSection,
  FinalCTA,
  LandingFooter,
} from '@/components/landing';

const SITE_URL = 'https://glossboss.ink';

export default function Landing({ lang }: { lang?: AppLanguage }) {
  const currentLang = lang ?? 'en';

  // Set hreflang meta tags for SEO
  useEffect(() => {
    const head = document.head;
    const existing = head.querySelectorAll('link[data-hreflang]');
    existing.forEach((el) => el.remove());

    // x-default → English (root)
    const xDefault = document.createElement('link');
    xDefault.rel = 'alternate';
    xDefault.hreflang = 'x-default';
    xDefault.href = SITE_URL + '/';
    xDefault.setAttribute('data-hreflang', 'true');
    head.appendChild(xDefault);

    // One link per language
    for (const option of APP_LANGUAGE_OPTIONS) {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = option.value;
      link.href = option.value === 'en' ? SITE_URL + '/' : `${SITE_URL}/${option.value}`;
      link.setAttribute('data-hreflang', 'true');
      head.appendChild(link);
    }

    return () => {
      head.querySelectorAll('link[data-hreflang]').forEach((el) => el.remove());
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface-0">
      <LandingNav currentLang={currentLang} />
      <EarlyBetaBanner />
      <HeroSection />
      <ProductShowcase />
      <SocialProofBar />
      <HowItWorks />
      <FeatureGrid />
      <FormatSection />
      <OpenSourceSection />
      <PricingSection />
      <FAQSection />
      <FinalCTA />
      <LandingFooter currentLang={currentLang} />
    </div>
  );
}
