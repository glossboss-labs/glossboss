import {
  Languages,
  Globe,
  Users,
  CheckCircle,
  ShieldCheck,
  GitBranch,
  Database,
  Lock,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation, msgid } from '@/lib/app-language';

const features = [
  {
    Icon: Languages,
    name: msgid('Three AI providers, one click'),
    description: msgid(
      'Switch between DeepL, Azure, and Gemini mid-session. Gemini even reads your plugin source code for context-aware translations.',
    ),
  },
  {
    Icon: Globe,
    name: msgid('Built for WordPress'),
    description: msgid(
      'Load glossaries from WordPress.org, browse plugin source files, and import .po files directly from the plugin directory.',
    ),
  },
  {
    Icon: Users,
    name: msgid('Collaborate in real-time'),
    description: msgid(
      'See who is editing what. Presence indicators, edit locking, and live updates keep your team in sync.',
    ),
  },
  {
    Icon: CheckCircle,
    name: msgid('Review before you ship'),
    description: msgid(
      'Full review workflow with draft, in-review, and approved statuses. Threaded comments on every string.',
    ),
  },
  {
    Icon: ShieldCheck,
    name: msgid('Catch errors automatically'),
    description: msgid(
      'Seven QA checks run on every translation: placeholders, HTML tags, ICU variables, glossary mismatches, and more.',
    ),
  },
  {
    Icon: GitBranch,
    name: msgid('Push to GitHub in one click'),
    description: msgid(
      'Open files from your repo, translate, and commit or create a pull request — without leaving the editor.',
    ),
  },
  {
    Icon: Database,
    name: msgid('Never translate twice'),
    description: msgid(
      'Translation memory with exact and fuzzy matching reuses your previous work across all projects.',
    ),
  },
  {
    Icon: Lock,
    name: msgid('Open source, privacy-first'),
    description: msgid(
      'AGPL-3.0 licensed. No tracking cookies. Local drafts auto-save in your browser. GDPR compliant.',
    ),
  },
];

export function FeatureGrid() {
  const { t } = useTranslation();

  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            {t('Everything you need to ship translations')}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
            {t(
              'AI translation, quality checks, team reviews, and direct repo integration — all in one browser tab.',
            )}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <motion.div
              key={feature.name}
              initial={{ opacity: 0.15, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px' }}
              transition={{ duration: 0.4, delay: 0 }}
              className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-1 p-5"
            >
              <feature.Icon className="h-7 w-7 text-text-tertiary" strokeWidth={1.5} />
              <h3 className="text-sm font-semibold text-text-primary">{t(feature.name)}</h3>
              <p className="text-sm leading-relaxed text-text-secondary">
                {t(feature.description)}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
