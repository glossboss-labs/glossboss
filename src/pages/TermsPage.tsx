import { LandingNav, LandingFooter } from '@/components/landing';
import { useTranslation } from '@/lib/app-language';

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface-0">
      <LandingNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-text-primary">
          {t('Terms of Service')}
        </h1>
        <div className="space-y-6 text-[0.935rem] leading-relaxed text-text-secondary">
          <p>
            {t(
              'These terms govern your use of GlossBoss ("the Service"), operated by GlossBoss Labs. By creating an account or using the Service, you agree to these terms. If you do not agree, please do not use the Service.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('1. The Service')}
          </h2>
          <p>
            {t(
              'GlossBoss is a browser-based translation editor for gettext and i18next translation files. It provides a web-based editor for managing translations, with optional cloud features including project hosting, team collaboration, and machine translation integrations.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('2. Accounts')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t('You must provide accurate information when creating an account.')}</li>
            <li>{t('You are responsible for keeping your account credentials secure.')}</li>
            <li>
              {t(
                'You must be at least 16 years old to create an account (or the minimum age required by your jurisdiction).',
              )}
            </li>
            <li>
              {t(
                'One person or legal entity may not maintain more than one free account. You may have multiple paid accounts.',
              )}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('3. Acceptable use')}
          </h2>
          <p>{t('You agree not to:')}</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              {t('Use the Service for any unlawful purpose or in violation of any applicable law.')}
            </li>
            <li>
              {t(
                'Attempt to gain unauthorized access to the Service, other accounts, or related systems.',
              )}
            </li>
            <li>
              {t(
                'Use automated means to access the Service in a way that exceeds reasonable use or bypasses rate limits.',
              )}
            </li>
            <li>
              {t(
                'Upload or transmit viruses, malware, or any code designed to interfere with the Service.',
              )}
            </li>
            <li>{t('Resell access to the Service without written permission.')}</li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('4. Intellectual property')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-text-primary">{t('Your content:')}</strong>{' '}
              {t(
                'You retain full ownership of all translations, glossaries, and project data you create using the Service. GlossBoss does not claim any intellectual property rights over your content.',
              )}
            </li>
            <li>
              <strong className="text-text-primary">{t('The Service:')}</strong>{' '}
              {t('The GlossBoss application source code is licensed under the')}{' '}
              <a
                href="/license"
                className="text-text-primary underline underline-offset-2 hover:opacity-80"
              >
                {t('GNU Affero General Public License v3.0')}
              </a>{' '}
              {t(
                '(AGPL-3.0). The GlossBoss name, logo, and branding are trademarks of GlossBoss Labs.',
              )}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('5. Billing and subscriptions')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              {t(
                'Free accounts are available with usage limits. Paid plans offer higher limits and additional features.',
              )}
            </li>
            <li>
              {t('Subscriptions are billed monthly or annually through our payment processor,')}{' '}
              <a
                href="https://polar.sh"
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-primary underline underline-offset-2 hover:opacity-80"
              >
                {t('Polar.sh')}
              </a>
              .
            </li>
            <li>
              {t(
                'Prices are displayed before purchase. We will notify you of price changes at least 30 days in advance.',
              )}
            </li>
            <li>
              {t(
                'You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period. No partial refunds are issued for unused time.',
              )}
            </li>
            <li>
              {t(
                'If payment fails, we may downgrade your account to the free tier after a reasonable grace period.',
              )}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('6. Refunds')}
          </h2>
          <p>
            {t(
              'We offer refunds on a case-by-case basis within 14 days of purchase if you have not substantially used the paid features. Contact us to request a refund. Annual subscriptions are eligible for a prorated refund within the first 30 days.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('7. Data handling')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              {t('Our')}{' '}
              <a
                href="/privacy"
                className="text-text-primary underline underline-offset-2 hover:opacity-80"
              >
                {t('Privacy Policy')}
              </a>{' '}
              {t(
                'describes what data we collect, how we use it, and your rights regarding your data.',
              )}
            </li>
            <li>
              {t(
                'You may export your data or delete your account at any time from the Settings page.',
              )}
            </li>
            <li>
              {t(
                'We use third-party services (translation APIs, hosting, payment processing) to provide the Service. Your use of the Service constitutes consent to share data with these providers as described in our Privacy Policy.',
              )}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('8. Service availability')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              {t(
                'We aim to keep the Service available and reliable, but we do not guarantee any specific uptime or service level.',
              )}
            </li>
            <li>
              {t(
                'The Service may be temporarily unavailable for maintenance, updates, or due to circumstances beyond our control.',
              )}
            </li>
            <li>
              {t(
                'We may modify, suspend, or discontinue features of the Service with reasonable notice.',
              )}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('9. Limitation of liability')}
          </h2>
          <p>
            {t(
              'To the maximum extent permitted by law, GlossBoss Labs and its contributors shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenue, whether incurred directly or indirectly, or any loss of data or use, arising from your use of the Service.',
            )}
          </p>
          <p>
            {t(
              'The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('10. Termination')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              {t(
                'You may close your account at any time through the Settings page. Account deletion is permanent and cannot be undone.',
              )}
            </li>
            <li>
              {t(
                'We may suspend or terminate accounts that violate these terms, with notice where practical.',
              )}
            </li>
            <li>
              {t(
                'Upon termination, your right to use the Service ceases. Data deletion follows our retention policy as described in the Privacy Policy.',
              )}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('11. Open source')}
          </h2>
          <p>
            {t(
              'The GlossBoss application is open source under the AGPL-3.0 license. You may self-host the software under the terms of that license. These Terms of Service apply only to the hosted service at',
            )}{' '}
            <strong className="text-text-primary">glossboss.ink</strong>{' '}
            {t('and do not restrict your rights under the AGPL.')}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('12. Changes to these terms')}
          </h2>
          <p>
            {t(
              'We may update these terms from time to time. We will notify registered users of material changes via email or an in-app notice at least 14 days before they take effect. Continued use of the Service after changes take effect constitutes acceptance of the updated terms.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('13. Governing law')}
          </h2>
          <p>
            {t(
              'These terms are governed by the laws of the Netherlands. Any disputes arising from these terms or your use of the Service shall be resolved in the courts of the Netherlands.',
            )}
          </p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('Contact')}
          </h2>
          <p>
            {t('Questions about these terms? Reach us at')}{' '}
            <a
              href="mailto:hi@glossboss.ink"
              className="text-text-primary underline underline-offset-2 hover:opacity-80"
            >
              hi@glossboss.ink
            </a>
            .
          </p>

          <p className="italic text-text-tertiary">{t('Last updated: March 2026')}</p>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
