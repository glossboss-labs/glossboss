import { useTranslation } from '@/lib/app-language';

export function EarlyBetaBanner() {
  const { t } = useTranslation();

  return (
    <div className="border-b border-accent/20 bg-accent/[0.06] px-6 py-2.5">
      <p className="mx-auto text-center text-xs leading-relaxed text-text-secondary sm:text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-accent uppercase sm:text-xs">
          {t('Beta')}
        </span>{' '}
        {t('Usable for real work, improving fast.')}
      </p>
    </div>
  );
}
