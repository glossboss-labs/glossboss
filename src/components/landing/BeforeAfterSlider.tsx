import { X, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation, msgid } from '@/lib/app-language';

const before = [
  msgid('Scattered .po files across your desktop'),
  msgid('Manual copy-paste between translation tools'),
  msgid('No terminology consistency across projects'),
  msgid('Email files back and forth for review'),
  msgid('No quality checks — hope for the best'),
];

const after = [
  msgid('One browser-based editor for all files'),
  msgid('AI translation from 3 providers in one click'),
  msgid('Glossary enforcement keeps terms consistent'),
  msgid('Push translations to GitHub or GitLab directly'),
  msgid('7 automatic QA checks catch errors before shipping'),
];

export function BeforeAfterSlider() {
  const { t } = useTranslation();

  return (
    <section className="border-y border-border-subtle px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            {t('The old way vs. the GlossBoss way')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Before side */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="rounded-lg border border-border-subtle border-l-2 border-l-status-untranslated bg-surface-1 p-6 shadow-sm"
          >
            <p className="mb-5 text-xs font-medium uppercase tracking-widest text-status-untranslated">
              {t('Without GlossBoss')}
            </p>
            <ul className="space-y-3">
              {before.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-status-untranslated" strokeWidth={2} />
                  {t(item)}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* After side */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-lg border border-border-subtle border-l-2 border-l-status-translated bg-surface-1 p-6 shadow-sm"
          >
            <p className="mb-5 text-xs font-medium uppercase tracking-widest text-status-translated">
              {t('With GlossBoss')}
            </p>
            <ul className="space-y-3">
              {after.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-status-translated"
                    strokeWidth={2}
                  />
                  {t(item)}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
