import { useState } from 'react';
import {
  Languages,
  Globe,
  Users,
  CheckCircle,
  ShieldCheck,
  GitBranch,
  Database,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation, msgid } from '@/lib/app-language';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Data — all user-facing strings wrapped in msgid() for extraction  */
/* ------------------------------------------------------------------ */

interface PrimaryFeature {
  id: string;
  Icon: LucideIcon;
  name: string;
  description: string;
  detail: string;
}

interface SecondaryFeature {
  Icon: LucideIcon;
  name: string;
  description: string;
}

const primaryFeatures: PrimaryFeature[] = [
  {
    id: 'ai',
    Icon: Languages,
    name: msgid('AI Translation'),
    description: msgid('Seven AI providers, one click'),
    detail: msgid(
      'Use DeepL, OpenAI, Claude, Gemini, Mistral, DeepSeek, and Azure from one editor. Switch providers inline when your project settings allow it, and give LLM providers source-code context so they understand where each string appears in your UI.',
    ),
  },
  {
    id: 'wordpress',
    Icon: Globe,
    name: msgid('WordPress'),
    description: msgid('Built for WordPress'),
    detail: msgid(
      'Load glossaries from WordPress.org, browse plugin source files via SVN, and import .po files directly from the plugin directory. Deep integration that understands the WordPress ecosystem.',
    ),
  },
  {
    id: 'collaboration',
    Icon: Users,
    name: msgid('Collaboration'),
    description: msgid('Collaborate in real-time'),
    detail: msgid(
      'See who is editing what. Presence indicators, edit locking, and live updates keep your team in sync. No more merge conflicts or overwritten translations.',
    ),
  },
  {
    id: 'qa',
    Icon: ShieldCheck,
    name: msgid('QA Checks'),
    description: msgid('Catch errors automatically'),
    detail: msgid(
      'Seven QA checks run on every translation: placeholders, HTML tags, ICU variables, glossary mismatches, and more. Errors are flagged before they reach production.',
    ),
  },
];

const secondaryFeatures: SecondaryFeature[] = [
  {
    Icon: CheckCircle,
    name: msgid('Review'),
    description: msgid('Full review workflow with draft, in-review, and approved statuses.'),
  },
  {
    Icon: GitBranch,
    name: msgid('Repo Sync'),
    description: msgid(
      'Open files from GitHub or GitLab, translate, and create a pull or merge request.',
    ),
  },
  {
    Icon: Database,
    name: msgid('Translation Memory'),
    description: msgid('Exact and fuzzy matching reuses previous work across projects.'),
  },
  {
    Icon: Lock,
    name: msgid('Privacy'),
    description: msgid(
      'AGPL-3.0 licensed. No cookies, no personal data collected. GDPR compliant.',
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Visual element for the selected tab's content area                */
/* ------------------------------------------------------------------ */

const featureVisuals: Record<string, { gradient: string; accent: string }> = {
  ai: { gradient: 'from-blue-500/10 to-violet-500/10', accent: 'text-blue-400' },
  wordpress: { gradient: 'from-emerald-500/10 to-teal-500/10', accent: 'text-emerald-400' },
  collaboration: { gradient: 'from-amber-500/10 to-orange-500/10', accent: 'text-amber-400' },
  qa: { gradient: 'from-rose-500/10 to-pink-500/10', accent: 'text-rose-400' },
};

/* ------------------------------------------------------------------ */
/*  Tab button (extracted to a named component for React Compiler)    */
/* ------------------------------------------------------------------ */

function TabButton({
  feature,
  isActive,
  onClick,
}: {
  feature: PrimaryFeature;
  isActive: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const Icon = feature.Icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-200',
        isActive
          ? 'bg-surface-2 text-text-primary'
          : 'text-text-tertiary hover:bg-surface-1 hover:text-text-secondary',
      )}
    >
      {isActive && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 rounded-lg border border-border-default bg-surface-2"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      <Icon
        className={cn(
          'relative z-10 h-5 w-5 shrink-0 transition-colors duration-200',
          isActive ? 'text-accent' : 'text-text-tertiary group-hover:text-text-secondary',
        )}
        strokeWidth={1.5}
      />
      <div className="relative z-10">
        <span className="block text-sm font-semibold">{t(feature.name)}</span>
        <span
          className={cn(
            'block text-xs transition-colors duration-200',
            isActive ? 'text-text-secondary' : 'text-text-tertiary',
          )}
        >
          {t(feature.description)}
        </span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Compact card for the secondary row                                */
/* ------------------------------------------------------------------ */

function CompactCard({ feature }: { feature: SecondaryFeature }) {
  const { t } = useTranslation();
  const Icon = feature.Icon;

  return (
    <motion.div
      initial={{ opacity: 0.15, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px' }}
      transition={{ duration: 0.4 }}
      className="group flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-sm transition-all duration-200 hover:scale-[1.03] hover:border-border-default hover:bg-surface-2"
    >
      <Icon
        className="h-6 w-6 text-text-tertiary transition-colors duration-200 group-hover:text-accent"
        strokeWidth={1.5}
      />
      <h3 className="text-sm font-semibold text-text-primary">{t(feature.name)}</h3>
      <p className="text-xs leading-relaxed text-text-secondary">{t(feature.description)}</p>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function FeatureGrid() {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState(primaryFeatures[0].id);

  const activeFeature = primaryFeatures.find((f) => f.id === activeId) ?? primaryFeatures[0];
  const visual = featureVisuals[activeFeature.id];
  const ActiveIcon = activeFeature.Icon;

  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
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

        {/* Tabbed feature showcase */}
        <motion.div
          initial={{ opacity: 0.15, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '0px' }}
          transition={{ duration: 0.5 }}
          className="mb-6 grid gap-4 rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-sm sm:grid-cols-[220px_1fr] sm:p-6 lg:grid-cols-[260px_1fr]"
        >
          {/* Tab list */}
          <nav className="flex flex-row gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
            {primaryFeatures.map((feature) => (
              <TabButton
                key={feature.id}
                feature={feature}
                isActive={activeId === feature.id}
                onClick={() => setActiveId(feature.id)}
              />
            ))}
          </nav>

          {/* Content area */}
          <div className="relative min-h-[240px] overflow-hidden rounded-lg border border-border-subtle bg-surface-0 sm:min-h-[280px]">
            {/* Gradient backdrop */}
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-br opacity-60 transition-all duration-500',
                visual.gradient,
              )}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="relative z-10 flex h-full flex-col justify-center p-6 sm:p-8"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border-subtle bg-surface-1">
                  <ActiveIcon className={cn('h-6 w-6', visual.accent)} strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-text-primary">
                  {t(activeFeature.description)}
                </h3>
                <p className="max-w-lg text-sm leading-relaxed text-text-secondary">
                  {t(activeFeature.detail)}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Compact secondary features row */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {secondaryFeatures.map((feature) => (
            <CompactCard key={feature.name} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
