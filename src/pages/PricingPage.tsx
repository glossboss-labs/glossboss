import { LandingFooter, LandingNav, PricingSection, FinalCTA } from '@/components/landing';
import { SeoMeta } from '@/components/SeoMeta';
import { useAuth } from '@/hooks/use-auth';
import { msgid } from '@/lib/app-language';

const META_TITLE = msgid('Pricing for Translation Teams — GlossBoss');
const BROWSER_TITLE = msgid('Pricing — GlossBoss');
const META_DESCRIPTION = msgid(
  'Compare GlossBoss plans for cloud translation projects, collaboration, repository sync, and pay-as-you-go usage.',
);

export default function PricingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-surface-0">
      <SeoMeta
        title={META_TITLE}
        browserTitle={BROWSER_TITLE}
        description={META_DESCRIPTION}
        canonicalPath="/pricing"
      />
      <LandingNav currentLang="en" isAuthenticated={isAuthenticated} />
      <main>
        <PricingSection />
        <FinalCTA />
      </main>
      <LandingFooter currentLang="en" />
    </div>
  );
}
