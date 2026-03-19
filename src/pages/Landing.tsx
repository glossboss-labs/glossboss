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
import { SeoMeta } from '@/components/SeoMeta';

const META_TITLE = msgid('GlossBoss — Open-Source Translation Platform');
const META_DESCRIPTION = msgid(
  'Free, open-source translation editor for PO, POT, and i18next JSON files. AI translation from DeepL, OpenAI, Claude, Gemini, Mistral, DeepSeek & Azure with real-time collaboration and GitHub/GitLab sync.',
);

export default function Landing({
  lang,
  isAuthenticated,
}: {
  lang?: AppLanguage;
  isAuthenticated?: boolean;
}) {
  const currentLang = lang ?? 'en';
  const { t } = useTranslation();
  const canonicalPath = currentLang === 'en' ? '/' : `/${currentLang}`;

  return (
    <div className="min-h-screen bg-surface-0">
      <SeoMeta
        title={t(META_TITLE)}
        description={t(META_DESCRIPTION)}
        canonicalPath={canonicalPath}
      />
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
