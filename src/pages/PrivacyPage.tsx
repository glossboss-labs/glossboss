import { LandingNav, LandingFooter } from '@/components/landing';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-0">
      <LandingNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-text-primary">Privacy Policy</h1>
        <div className="space-y-6 text-[0.935rem] leading-relaxed text-text-secondary">
          <p>
            GlossBoss ("the Service") is operated by GlossBoss Labs. This policy explains what data
            we collect, why, and how you can control it. We process the minimum data needed to
            provide the Service and do not sell your personal information.
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            1. Data we collect
          </h2>

          <h3 className="!mb-2 !mt-6 text-base font-semibold text-text-primary">Account data</h3>
          <p>
            When you create an account, we store your email address, display name, and avatar (from
            GitHub if you use OAuth). This data is stored in{' '}
            <a
              href="https://supabase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-primary underline underline-offset-2 hover:opacity-80"
            >
              Supabase
            </a>{' '}
            (hosted in the United States).
          </p>

          <h3 className="!mb-2 !mt-6 text-base font-semibold text-text-primary">Project data</h3>
          <p>
            Translation projects, entries, glossaries, organization memberships, and related
            metadata are stored in our Supabase database. This data belongs to you and can be
            exported or deleted at any time from the Settings page.
          </p>

          <h3 className="!mb-2 !mt-6 text-base font-semibold text-text-primary">Browser storage</h3>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Editor state, draft data, glossary preferences, and UI settings are stored in your
              browser's local storage.
            </li>
            <li>
              If you enter API keys for translation services, they are kept in session storage by
              default and cleared when you close all GlossBoss tabs. If you enable "remember key",
              they are also saved to local storage.
            </li>
          </ul>

          <h3 className="!mb-2 !mt-6 text-base font-semibold text-text-primary">Analytics</h3>
          <p>
            We use{' '}
            <a
              href="https://posthog.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-primary underline underline-offset-2 hover:opacity-80"
            >
              PostHog
            </a>{' '}
            (EU Cloud, hosted in Frankfurt, Germany) for product analytics. PostHog is configured in
            cookie-less mode — no cookies are set and data is stored in memory only. Analytics
            requests are routed through a first-party proxy on our domain and never sent to
            third-party tracking domains directly.
          </p>
          <p>We collect the following analytics data to improve the product:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">Page views</strong> — which pages you visit and
              how you navigate the app.
            </li>
            <li>
              <strong className="text-text-primary">Feature usage events</strong> — actions like
              opening files, running translations, exporting, creating projects, and changing
              settings. These events include technical metadata (e.g. file entry count, translation
              mode) but not the content of your translations.
            </li>
            <li>
              <strong className="text-text-primary">User identity</strong> — if you are signed in,
              your user ID and email address are linked to your analytics session so we can
              understand usage patterns. You can opt out by enabling Do Not Track in your browser.
            </li>
            <li>
              <strong className="text-text-primary">Autocapture</strong> — PostHog automatically
              records clicks on interactive elements (buttons, links) to help us understand how the
              interface is used. No form input values or text content are captured.
            </li>
          </ul>
          <p>
            We honor the <strong className="text-text-primary">Do Not Track</strong> browser
            setting. When DNT is enabled, no analytics data is collected. Session recording is
            disabled.
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            2. Third-party services
          </h2>
          <p>
            The Service integrates with third-party providers. Data is shared only as needed to
            deliver the functionality you use.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Service
                  </th>
                  <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Data shared
                  </th>
                  <th className="py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Purpose
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">Supabase</td>
                  <td className="py-2 pr-4">Account, projects, translations, settings</td>
                  <td className="py-2">Authentication, database, backend</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">Polar.sh</td>
                  <td className="py-2 pr-4">Email, customer ID, payment info</td>
                  <td className="py-2">Subscription billing</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">GitHub</td>
                  <td className="py-2 pr-4">Email, name, avatar (via OAuth)</td>
                  <td className="py-2">Sign-in, feedback issue creation</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">DeepL</td>
                  <td className="py-2 pr-4">Translation text, glossary terms</td>
                  <td className="py-2">Machine translation</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">Azure Translator</td>
                  <td className="py-2 pr-4">Translation text</td>
                  <td className="py-2">Machine translation</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">Google Gemini</td>
                  <td className="py-2 pr-4">Translation text, project context, glossary</td>
                  <td className="py-2">AI-powered translation</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">ElevenLabs</td>
                  <td className="py-2 pr-4">Text (up to 500 chars), your API key</td>
                  <td className="py-2">Text-to-speech preview</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">Cloudflare Turnstile</td>
                  <td className="py-2 pr-4">Browser fingerprint</td>
                  <td className="py-2">Bot detection on feedback form</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">WordPress.org</td>
                  <td className="py-2 pr-4">Plugin/theme slug lookups</td>
                  <td className="py-2">Source file and glossary fetching</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-text-primary">PostHog</td>
                  <td className="py-2 pr-4">
                    Page views, feature events, user ID, email (cookie-less, via first-party proxy)
                  </td>
                  <td className="py-2">Product analytics</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            Translation providers (DeepL, Azure, Gemini) and text-to-speech (ElevenLabs) are only
            activated when you explicitly configure them. No data is sent to these services until
            you use the feature.
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            3. Legal basis for processing
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">Contract performance:</strong> Account data,
              project data, and billing data are processed to deliver the Service you signed up for.
            </li>
            <li>
              <strong className="text-text-primary">Legitimate interest:</strong> Analytics data is
              processed to improve the Service. We use cookie-less tracking to minimize privacy
              impact.
            </li>
            <li>
              <strong className="text-text-primary">Consent:</strong> Optional integrations
              (translation providers, TTS, cloud sync of credentials) are only activated when you
              explicitly enable them.
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            4. Cross-border data transfers
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">Supabase</strong> hosts our database and
              authentication in the United States. Supabase complies with SOC 2 Type II.
            </li>
            <li>
              <strong className="text-text-primary">PostHog</strong> analytics data is stored in the
              EU (Frankfurt, Germany).
            </li>
            <li>
              <strong className="text-text-primary">Polar.sh</strong> processes billing data.
              Payment processing is handled by Stripe, which is certified under the EU-US Data
              Privacy Framework.
            </li>
            <li>
              Translation API calls to DeepL (EU), Azure (region-dependent), and Google Gemini (US)
              are transient — text is sent for translation and not stored by GlossBoss after the
              response is received.
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            5. Data retention
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">Account and project data</strong> is retained
              for as long as your account is active.
            </li>
            <li>
              <strong className="text-text-primary">Deleted accounts</strong> are purged
              immediately. All associated projects, translations, organization memberships,
              notifications, and subscription records are permanently deleted.
            </li>
            <li>
              <strong className="text-text-primary">Analytics data</strong> is retained by PostHog
              according to their data retention policies. User ID and email are linked to analytics
              sessions; all other event data is non-personal metadata. Analytics data is deleted
              when you delete your account.
            </li>
            <li>
              <strong className="text-text-primary">Feedback submissions</strong> are stored as
              GitHub issues and retained indefinitely for product improvement.
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            6. Your rights
          </h2>
          <p>Under GDPR and similar privacy laws, you have the right to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">Access</strong> your data — export all your data
              as JSON from Settings.
            </li>
            <li>
              <strong className="text-text-primary">Rectification</strong> — update your profile
              information in Settings.
            </li>
            <li>
              <strong className="text-text-primary">Erasure</strong> — permanently delete your
              account and all associated data from Settings.
            </li>
            <li>
              <strong className="text-text-primary">Data portability</strong> — download a
              machine-readable export of your data.
            </li>
            <li>
              <strong className="text-text-primary">Object</strong> — disable analytics by enabling
              Do Not Track in your browser.
            </li>
            <li>
              <strong className="text-text-primary">Restrict processing</strong> — disable optional
              features (cloud sync, translation providers) at any time.
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            7. Your controls
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Delete your account and all data permanently from Settings.</li>
            <li>Export all your data as JSON from Settings.</li>
            <li>Clear saved API credentials from Settings.</li>
            <li>Disable cloud sync to keep all settings local to your browser.</li>
            <li>Clear local drafts and caches by removing browser storage for this site.</li>
            <li>Avoid entering an email address when sending feedback.</li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            8. Cookies
          </h2>
          <p>
            GlossBoss does not use tracking cookies. Authentication state is managed via Supabase's
            session tokens stored in local storage. Analytics (PostHog) runs in cookie-less mode
            using in-memory persistence. Analytics requests are routed through a first-party proxy
            on our domain — no third-party tracking domains are contacted from your browser.
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            9. Children
          </h2>
          <p>
            The Service is not directed at children under 16. We do not knowingly collect personal
            information from children. If you believe a child has provided us with personal data,
            please contact us.
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            10. Sub-processors
          </h2>
          <p>We use the following sub-processors to provide the Service:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">Supabase Inc.</strong> — Database,
              authentication, edge functions (US)
            </li>
            <li>
              <strong className="text-text-primary">Cloudflare Inc.</strong> — Hosting, CDN, DNS,
              bot protection, analytics proxy (Global)
            </li>
            <li>
              <strong className="text-text-primary">Polar.sh</strong> — Subscription billing (EU)
            </li>
            <li>
              <strong className="text-text-primary">PostHog Inc.</strong> — Product analytics (EU —
              Frankfurt)
            </li>
            <li>
              <strong className="text-text-primary">GitHub Inc.</strong> — OAuth provider, feedback
              storage (US)
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            11. Changes to this policy
          </h2>
          <p>
            We may update this policy from time to time. Material changes will be communicated via
            email or in-app notice at least 14 days before they take effect. The "last updated" date
            below reflects the most recent revision.
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            Contact
          </h2>
          <p>
            For privacy inquiries, data requests, or concerns:{' '}
            <a
              href="mailto:privacy@glossboss.ink"
              className="text-text-primary underline underline-offset-2 hover:opacity-80"
            >
              privacy@glossboss.ink
            </a>
          </p>

          <p className="italic text-text-tertiary">Last updated: March 2026</p>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
