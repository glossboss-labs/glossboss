import { LandingNav, LandingFooter } from '@/components/landing';
import { useTranslation } from '@/lib/app-language';

export default function LicensePage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface-0">
      <LandingNav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-4 text-3xl font-bold tracking-tight text-text-primary">{t('License')}</h1>
        <div className="space-y-6 text-[0.935rem] leading-relaxed text-text-secondary">
          <p>
            {t('GlossBoss is licensed under the')}{' '}
            <strong className="text-text-primary">
              {t('GNU Affero General Public License v3.0 only')}
            </strong>{' '}
            (
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[0.85em]">
              {t('AGPL-3.0-only')}
            </code>
            ).
          </p>
          <p>{t('Copyright (C) 2026 Toine Rademacher, Bjorn Lammers, and contributors.')}</p>
          <p>{t('GlossBoss is maintained by Toine Rademacher and Bjorn Lammers.')}</p>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('What that means')}
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t('You can use, study, modify, and share this project.')}</li>
            <li>
              {t(
                'If you distribute modified versions, you must also provide the corresponding source code under AGPL-3.0-only.',
              )}
            </li>
            <li>
              {t(
                'If you run a modified version as a network service, users must be able to get the corresponding source code for that modified version.',
              )}
            </li>
          </ul>

          <h2 className="!mb-3 !mt-10 text-lg font-semibold tracking-tight text-text-primary">
            {t('Full license text')}
          </h2>
          <p>
            {t('The full license text for this deployment is available in the local')}{' '}
            <a
              href="/license/LICENSE.txt"
              className="text-text-primary underline underline-offset-2 hover:opacity-80"
            >
              {t('LICENSE file')}
            </a>
            .
          </p>
          <p>
            {t(
              'Additional project attribution and notice details are documented in the repository NOTICE file.',
            )}
          </p>
          <p>
            {t(
              'Under the AGPL, the operator of this deployment must make the corresponding source code available to network users.',
            )}
          </p>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
