import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import { User, Users, Building2, Hash, GitBranch, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation, msgid } from '@/lib/app-language';
import { PLAN_PRICING } from '@/lib/billing/polar';
import { FLEX_PRICING } from '@/lib/billing/limits';
import type { PlanTier } from '@/lib/billing/types';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type UseCase = 'individual' | 'team' | 'agency';
type Volume = 'low' | 'medium' | 'high';
type GitIntegration = 'yes' | 'no';

interface OptionCard<T extends string> {
  value: T;
  label: string;
  Icon: LucideIcon;
}

interface Question<T extends string> {
  key: string;
  title: string;
  options: OptionCard<T>[];
}

/* ------------------------------------------------------------------ */
/*  Question definitions                                               */
/* ------------------------------------------------------------------ */

const questions: [Question<UseCase>, Question<Volume>, Question<GitIntegration>] = [
  {
    key: 'use-case',
    title: msgid('How will you use GlossBoss?'),
    options: [
      { value: 'individual', label: msgid('Just me'), Icon: User },
      { value: 'team', label: msgid('With a team'), Icon: Users },
      { value: 'agency', label: msgid('For clients'), Icon: Building2 },
    ],
  },
  {
    key: 'volume',
    title: msgid('How many strings do you translate?'),
    options: [
      { value: 'low', label: msgid('Under 5,000'), Icon: Hash },
      { value: 'medium', label: msgid('5,000 – 100,000'), Icon: Hash },
      { value: 'high', label: msgid('Over 100,000'), Icon: Hash },
    ],
  },
  {
    key: 'git',
    title: msgid('Do you need GitHub/GitLab integration?'),
    options: [
      { value: 'yes', label: msgid('Yes'), Icon: GitBranch },
      { value: 'no', label: msgid('No'), Icon: GitBranch },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Recommendation logic                                               */
/* ------------------------------------------------------------------ */

interface Recommendation {
  tier: PlanTier;
  name: string;
  price: string;
}

const PLAN_DISPLAY: Record<PlanTier, { name: string; price: string }> = {
  free: { name: msgid('Free'), price: msgid('€0/mo') },
  flex: {
    name: msgid('Flex'),
    price: msgid('€{{price}}/1k strings'),
  },
  pro: { name: msgid('Pro'), price: msgid('€{{price}}/mo') },
  organization: { name: msgid('Organization'), price: msgid('€{{price}}/mo') },
};

function getRecommendation(useCase: UseCase, volume: Volume): Recommendation {
  let tier: PlanTier;

  if (useCase === 'agency') {
    tier = 'organization';
  } else if (useCase === 'team') {
    tier = volume === 'low' ? 'free' : 'pro';
  } else {
    // individual
    if (volume === 'low') tier = 'free';
    else if (volume === 'medium') tier = 'flex';
    else tier = 'pro';
  }

  const display = PLAN_DISPLAY[tier];
  return { tier, name: display.name, price: display.price };
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-8 rounded-full transition-colors duration-200',
            i < current ? 'bg-accent' : 'bg-surface-3',
          )}
        />
      ))}
    </div>
  );
}

function OptionCardButton<T extends string>({
  option,
  selected,
  onSelect,
  t,
}: {
  option: OptionCard<T>;
  selected: boolean;
  onSelect: (value: T) => void;
  t: (s: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border p-4 cursor-pointer transition-all',
        selected
          ? 'border-accent bg-accent/5'
          : 'border-border-subtle bg-surface-1 hover:border-accent/40 hover:bg-surface-2',
      )}
    >
      <option.Icon
        className={cn('h-6 w-6', selected ? 'text-accent' : 'text-text-secondary')}
        strokeWidth={1.5}
      />
      <span
        className={cn(
          'text-sm font-medium',
          selected ? 'text-text-primary' : 'text-text-secondary',
        )}
      >
        {t(option.label)}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function PlanQuiz() {
  const { t } = useTranslation();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<[UseCase | null, Volume | null, GitIntegration | null]>([
    null,
    null,
    null,
  ]);

  const totalSteps = questions.length;
  const showResult = step >= totalSteps;

  const handleSelect = useCallback(
    (value: string) => {
      setAnswers((prev) => {
        const next = [...prev] as typeof prev;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        next[step] = value as any;
        return next;
      });
      // Advance after a short delay so the user sees their selection
      setTimeout(() => setStep((s) => s + 1), 200);
    },
    [step],
  );

  const handleReset = useCallback(() => {
    setStep(0);
    setAnswers([null, null, null]);
  }, []);

  const recommendation =
    showResult && answers[0] && answers[1] && answers[2]
      ? getRecommendation(answers[0], answers[1])
      : null;

  const formatPrice = (rec: Recommendation): string => {
    if (rec.tier === 'free') return t(rec.price);
    if (rec.tier === 'flex') return t(rec.price, { price: String(FLEX_PRICING.pricePerKStrings) });
    return t(rec.price, { price: String(PLAN_PRICING[rec.tier].month) });
  };

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-xl">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            {t('Not sure which plan? Let us help.')}
          </h2>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-1 p-6 sm:p-8">
          {!showResult && <ProgressBar current={step + 1} total={totalSteps} />}

          <AnimatePresence mode="wait">
            {!showResult ? (
              <motion.div
                key={`step-${step}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
              >
                <p className="mb-1 text-center text-xs text-text-tertiary">
                  {t('Step {{current}} of {{total}}', {
                    current: String(step + 1),
                    total: String(totalSteps),
                  })}
                </p>
                <h3 className="mb-6 text-center text-base font-medium text-text-primary">
                  {t(questions[step].title)}
                </h3>
                <div
                  className={cn(
                    'grid gap-3',
                    questions[step].options.length === 2 ? 'grid-cols-2' : 'grid-cols-3',
                  )}
                >
                  {questions[step].options.map((option) => (
                    <OptionCardButton
                      key={option.value}
                      option={option}
                      selected={answers[step] === option.value}
                      onSelect={handleSelect}
                      t={t}
                    />
                  ))}
                </div>
              </motion.div>
            ) : recommendation ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <p className="mb-2 text-xs font-medium uppercase tracking-widest text-text-tertiary">
                  {t('We recommend')}
                </p>
                <h3 className="text-2xl font-semibold text-text-primary">
                  {t(recommendation.name)}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">{formatPrice(recommendation)}</p>

                <Link
                  to={
                    recommendation.tier === 'free'
                      ? '/signup'
                      : `/signup?plan=${recommendation.tier}`
                  }
                  className="mt-6 inline-block rounded-md bg-text-primary px-6 py-2.5 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
                >
                  {t('Get started with {{plan}}', { plan: t(recommendation.name) })}
                </Link>

                <button
                  type="button"
                  onClick={handleReset}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs text-text-tertiary transition-colors hover:text-text-secondary"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t('Start over')}
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
