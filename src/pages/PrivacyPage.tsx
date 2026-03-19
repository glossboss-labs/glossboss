import { LandingNav, LandingFooter } from '@/components/landing';
import { useTranslation } from '@/lib/app-language';

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface-0">
      <LandingNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-text-primary">
          {t('Privacy Policy')}
        </h1>
        <div className="space-y-6 text-[0.935rem] leading-relaxed text-text-secondary">
          <p>
            {t(
              'GlossBoss ("the Service") is operated by GlossBoss Labs. This policy explains what data we collect, why, and how you can control it. We process the minimum data needed to provide the Service and do not sell your personal information.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('1. Data we collect')}
          </h2>

          <h3 className="!mb-2 !mt-6 text-base font-semibold text-text-primary">
            {t('Account data')}
          </h3>
          <p>
            {t(
              'When you create an account, we store your email address, display name, and avatar (from GitHub if you use OAuth). This data is stored in',
            )}{' '}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-primary underline underline-offset-2 hover:opacity-80"
            >
              {t('Supabase')}
            </a>{' '}
            {t('(hosted in the United States).')}
          </p>

          <h3 className="!mb-2 !mt-6 text-base font-semibold text-text-primary">
            {t('Project data')}
          </h3>
          <p>
            {t(
              'Translation projects, entries, glossaries, organization memberships, and related metadata are stored in our Supabase database. This data belongs to you and can be exported or deleted at any time from the Settings page.',
            )}
          </p>

          <h3 className="!mb-2 !mt-6 text-base font-semibold text-text-primary">
            {t('Browser storage')}
          </h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              {t(
                "Editor state, draft data, glossary preferences, and UI settings are stored in your browser's local storage.",
              )}
            </li>
            <li>
              {t(
                'If you enter API keys for translation services, they are kept in session storage by default and cleared when you close all GlossBoss tabs. If you enable "remember key", they are also saved to local storage.',
              )}
            </li>
          </ul>

          <h3 className="!mb-2 !mt-6 text-base font-semibold text-text-primary">
            {t('Analytics')}
          </h3>
          <p>
            {t('We use')}{' '}
            <a
              href="https://posthog.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-primary underline underline-offset-2 hover:opacity-80"
            >
              {t('PostHog')}
            </a>{' '}
            {t(
              '(EU Cloud, hosted in Frankfurt, Germany) for product analytics. PostHog is configured in cookie-less mode - no cookies are set and data is stored in memory only. Analytics requests are routed through a first-party proxy on our domain and never sent to third-party tracking domains directly.',
            )}
          </p>
          <p>{t('We collect the following analytics data to improve the product:')}</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">{t('Page views')}</strong>{' '}
              {t('- which pages are visited and how users navigate the app.')}
            </li>
            <li>
              <strong className="text-text-primary">{t('Feature usage events')}</strong>{' '}
              {t(
                '- actions like opening files, running translations, exporting, creating projects, and changing settings. These events include technical metadata (e.g. file entry count, translation provider, language pair) but never the content of your translations or any personal data.',
              )}
            </li>
            <li>
              <strong className="text-text-primary">{t('Autocapture')}</strong>{' '}
              {t(
                '- PostHog automatically records clicks on interactive elements (buttons, links) to help us understand how the interface is used. No form input values or text content are captured.',
              )}
            </li>
          </ul>
          <p>
            {t(
              'No personal data — including user IDs, email addresses, or IP addresses — is sent to PostHog. All analytics data is fully anonymous and cannot be linked to individual users.',
            )}
          </p>
          <p>
            {t('We honor the')} <strong className="text-text-primary">{t('Do Not Track')}</strong>{' '}
            {t(
              'browser setting. When DNT is enabled, no analytics data is collected. Session recording is disabled.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('2. Third-party services')}
          </h2>
          <p>
            {t(
              'The Service integrates with third-party providers. Data is shared only as needed to deliver the functionality you use.',
            )}
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-text-primary">
                    {t('Service')}
                  </th>
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-text-primary">
                    {t('Data shared')}
                  </th>
                  <th className="py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-primary">
                    {t('Purpose')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">{t('Supabase')}</td>
                  <td className="py-2 pr-4">{t('Account, projects, translations, settings')}</td>
                  <td className="py-2">{t('Authentication, database, backend')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">{t('Polar.sh')}</td>
                  <td className="py-2 pr-4">{t('Email, customer ID, payment info')}</td>
                  <td className="py-2">{t('Subscription billing')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">{t('GitHub')}</td>
                  <td className="py-2 pr-4">{t('Email, name, avatar (via OAuth)')}</td>
                  <td className="py-2">{t('Sign-in, feedback issue creation')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">{t('DeepL')}</td>
                  <td className="py-2 pr-4">{t('Translation text, glossary terms')}</td>
                  <td className="py-2">{t('Machine translation')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">
                    {t('Azure Translator')}
                  </td>
                  <td className="py-2 pr-4">{t('Translation text')}</td>
                  <td className="py-2">{t('Machine translation')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">{t('Google Gemini')}</td>
                  <td className="py-2 pr-4">{t('Translation text, project context, glossary')}</td>
                  <td className="py-2">{t('AI-powered translation')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">{t('ElevenLabs')}</td>
                  <td className="py-2 pr-4">{t('Text (up to 500 chars), your API key')}</td>
                  <td className="py-2">{t('Text-to-speech preview')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">
                    {t('Cloudflare Turnstile')}
                  </td>
                  <td className="py-2 pr-4">{t('Browser fingerprint')}</td>
                  <td className="py-2">{t('Bot detection on feedback form')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">{t('WordPress.org')}</td>
                  <td className="py-2 pr-4">{t('Plugin/theme slug lookups')}</td>
                  <td className="py-2">{t('Source file and glossary fetching')}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">{t('PostHog')}</td>
                  <td className="py-2 pr-4">
                    {t(
                      'Anonymous page views, feature events (cookie-less, via first-party proxy, no personal data)',
                    )}
                  </td>
                  <td className="py-2">{t('Product analytics')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            {t(
              'Translation providers (DeepL, Azure, Gemini) and text-to-speech (ElevenLabs) are only activated when you explicitly configure them. No data is sent to these services until you use the feature.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('3. Legal basis for processing')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">{t('Contract performance:')}</strong>{' '}
              {t(
                'Account data, project data, and billing data are processed to deliver the Service you signed up for.',
              )}
            </li>
            <li>
              <strong className="text-text-primary">{t('Legitimate interest:')}</strong>{' '}
              {t(
                'Anonymous, aggregate analytics data is processed to improve the Service. No personal data is collected for analytics — we use cookie-less tracking with no user identification.',
              )}
            </li>
            <li>
              <strong className="text-text-primary">{t('Consent:')}</strong>{' '}
              {t(
                'Optional integrations (translation providers, TTS, cloud sync of credentials) are only activated when you explicitly enable them.',
              )}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('4. Cross-border data transfers')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">{t('Supabase')}</strong>{' '}
              {t(
                'hosts our database and authentication in the United States. Supabase complies with SOC 2 Type II.',
              )}
            </li>
            <li>
              <strong className="text-text-primary">{t('PostHog')}</strong>{' '}
              {t('analytics data is stored in the EU (Frankfurt, Germany).')}
            </li>
            <li>
              <strong className="text-text-primary">{t('Polar.sh')}</strong>{' '}
              {t(
                'processes billing data. Payment processing is handled by Stripe, which is certified under the EU-US Data Privacy Framework.',
              )}
            </li>
            <li>
              {t(
                'Translation API calls to DeepL (EU), Azure (region-dependent), and Google Gemini (US) are transient - text is sent for translation and not stored by GlossBoss after the response is received.',
              )}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('5. Data retention')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">{t('Account and project data')}</strong>{' '}
              {t('is retained for as long as your account is active.')}
            </li>
            <li>
              <strong className="text-text-primary">{t('Deleted accounts')}</strong>{' '}
              {t(
                'are purged immediately. All associated projects, translations, organization memberships, notifications, and subscription records are permanently deleted.',
              )}
            </li>
            <li>
              <strong className="text-text-primary">{t('Analytics data')}</strong>{' '}
              {t(
                'is retained by PostHog according to their data retention policies. Analytics data is fully anonymous — no user IDs, emails, or IP addresses are collected — so it cannot be linked to individual accounts.',
              )}
            </li>
            <li>
              <strong className="text-text-primary">{t('Feedback submissions')}</strong>{' '}
              {t('are stored as GitHub issues and retained indefinitely for product improvement.')}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('6. Your rights')}
          </h2>
          <p>{t('Under GDPR and similar privacy laws, you have the right to:')}</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">{t('Access')}</strong>{' '}
              {t('- export all your data as JSON from Settings.')}
            </li>
            <li>
              <strong className="text-text-primary">{t('Rectification')}</strong>{' '}
              {t('- update your profile information in Settings.')}
            </li>
            <li>
              <strong className="text-text-primary">{t('Erasure')}</strong>{' '}
              {t('- permanently delete your account and all associated data from Settings.')}
            </li>
            <li>
              <strong className="text-text-primary">{t('Data portability')}</strong>{' '}
              {t('- download a machine-readable export of your data.')}
            </li>
            <li>
              <strong className="text-text-primary">{t('Object')}</strong>{' '}
              {t('- disable analytics by enabling Do Not Track in your browser.')}
            </li>
            <li>
              <strong className="text-text-primary">{t('Restrict processing')}</strong>{' '}
              {t('- disable optional features (cloud sync, translation providers) at any time.')}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('7. Your controls')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t('Delete your account and all data permanently from Settings.')}</li>
            <li>{t('Export all your data as JSON from Settings.')}</li>
            <li>{t('Clear saved API credentials from Settings.')}</li>
            <li>{t('Disable cloud sync to keep all settings local to your browser.')}</li>
            <li>{t('Clear local drafts and caches by removing browser storage for this site.')}</li>
            <li>{t('Avoid entering an email address when sending feedback.')}</li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('8. Cookies')}
          </h2>
          <p>
            {t(
              "GlossBoss does not use tracking cookies. Authentication state is managed via Supabase's session tokens stored in local storage. Analytics (PostHog) runs in cookie-less mode using in-memory persistence. Analytics requests are routed through a first-party proxy on our domain - no third-party tracking domains are contacted from your browser.",
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('9. Children')}
          </h2>
          <p>
            {t(
              'The Service is not directed at children under 16. We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, please contact us.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('10. Sub-processors')}
          </h2>
          <p>{t('We use the following sub-processors to provide the Service:')}</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">{t('Supabase Inc.')}</strong>{' '}
              {t('- Database, authentication, edge functions (US)')}
            </li>
            <li>
              <strong className="text-text-primary">{t('Cloudflare Inc.')}</strong>{' '}
              {t('- Hosting, CDN, DNS, bot protection, analytics proxy (Global)')}
            </li>
            <li>
              <strong className="text-text-primary">{t('Polar.sh')}</strong>{' '}
              {t('- Subscription billing (EU)')}
            </li>
            <li>
              <strong className="text-text-primary">{t('PostHog Inc.')}</strong>{' '}
              {t('- Product analytics (EU - Frankfurt)')}
            </li>
            <li>
              <strong className="text-text-primary">{t('GitHub Inc.')}</strong>{' '}
              {t('- OAuth provider, feedback storage (US)')}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('11. Changes to this policy')}
          </h2>
          <p>
            {t(
              'We may update this policy from time to time. Material changes will be communicated via email or in-app notice at least 14 days before they take effect. The "last updated" date below reflects the most recent revision.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('Contact')}
          </h2>
          <p>
            {t('For privacy inquiries, data requests, or concerns:')}{' '}
            <a
              href="mailto:privacy@glossboss.ink"
              className="text-text-primary underline underline-offset-2 hover:opacity-80"
            >
              privacy@glossboss.ink
            </a>
          </p>

          <p className="italic text-text-tertiary">{t('Last updated: March 2026')}</p>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
