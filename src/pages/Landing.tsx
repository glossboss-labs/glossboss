import { useEffect } from 'react';
import { APP_LANGUAGE_OPTIONS, type AppLanguage } from '@/lib/app-language';
import {
  EarlyBetaBanner,
  LandingNav,
  HeroSection,
  ProductShowcase,
  SocialProofBar,
  StatsCounters,
  HowItWorks,
  FeatureGrid,
  BeforeAfterSlider,
  FormatSection,
  OpenSourceSection,
  PricingSection,
  FAQSection,
  FinalCTA,
  LandingFooter,
} from '@/components/landing';

const SITE_URL = 'https://glossboss.ink';

export default function Landing({
  lang,
  isAuthenticated,
}: {
  lang?: AppLanguage;
  isAuthenticated?: boolean;
}) {
  const currentLang = lang ?? 'en';

  // Set hreflang meta tags for SEO
  useEffect(() => {
    const head = document.head;
    const existing = head.querySelectorAll('link[data-hreflang]');
    existing.forEach((el) => el.remove());

    const xDefault = document.createElement('link');
    xDefault.rel = 'alternate';
    xDefault.hreflang = 'x-default';
    xDefault.href = SITE_URL + '/';
    xDefault.setAttribute('data-hreflang', 'true');
    head.appendChild(xDefault);

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
      <LandingNav currentLang={currentLang} isAuthenticated={isAuthenticated} />
      <EarlyBetaBanner />
      <HeroSection />
      <ProductShowcase />
      <SocialProofBar />
      <StatsCounters />
      <FeatureGrid />
      <BeforeAfterSlider />
      <HowItWorks />
      <FormatSection />
      <PricingSection />
      <OpenSourceSection />
      <FAQSection />
      <FinalCTA />
      <LandingFooter currentLang={currentLang} />
    </div>
  );
}
