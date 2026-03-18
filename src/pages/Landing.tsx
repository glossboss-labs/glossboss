import { useEffect } from 'react';
import { useTranslation, msgid, type AppLanguage } from '@/lib/app-language';
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

const META_TITLE = msgid('GlossBoss — Open-Source Translation Platform');
const META_DESCRIPTION = msgid(
  'Free, open-source translation editor for PO, POT, and i18next JSON files. AI translation from DeepL, OpenAI, Claude, Gemini, Mistral, DeepSeek & Azure with real-time collaboration and GitHub/GitLab sync.',
);
const DEFAULT_TITLE = 'GlossBoss — Open-Source Translation Platform';

export default function Landing({
  lang,
  isAuthenticated,
}: {
  lang?: AppLanguage;
  isAuthenticated?: boolean;
}) {
  const currentLang = lang ?? 'en';
  const { t } = useTranslation();

  // Update document meta tags with translated strings for SEO (Googlebot executes JS)
  useEffect(() => {
    document.title = t(META_TITLE);
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', t(META_DESCRIPTION));
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [currentLang, t]);

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
