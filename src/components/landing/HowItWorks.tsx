import { Upload, Sparkles, GitBranch } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation, msgid } from '@/lib/app-language';

const steps = [
  {
    number: '01',
    Icon: Upload,
    title: msgid('Import'),
    description: msgid(
      'Drag and drop your PO, POT, or i18next JSON files. Or connect your GitHub/GitLab repo.',
    ),
  },
  {
    number: '02',
    Icon: Sparkles,
    title: msgid('Translate'),
    description: msgid(
      'Translate with AI from DeepL, Azure, or Gemini. Review with your team. Run QA checks.',
    ),
  },
  {
    number: '03',
    Icon: GitBranch,
    title: msgid('Ship'),
    description: msgid(
      'Export your files or push directly to your repo with a single click. Create a PR. Done.',
    ),
  },
];

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-text-tertiary">
            {t('How it works')}
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            {t('From file to shipped in three steps')}
          </h2>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0.15, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px' }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border-subtle bg-surface-1">
                <step.Icon className="h-5 w-5 text-text-secondary" strokeWidth={1.5} />
              </div>
              <span className="mb-2 block text-xs font-medium text-text-tertiary">
                {step.number}
              </span>
              <h3 className="mb-2 text-base font-semibold text-text-primary">{t(step.title)}</h3>
              <p className="text-sm leading-relaxed text-text-secondary">{t(step.description)}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
