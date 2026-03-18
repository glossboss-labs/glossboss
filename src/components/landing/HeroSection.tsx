import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from '@/lib/app-language';
import { AnimatedGridPattern } from '@/components/magicui/animated-grid-pattern';
import { cn } from '@/lib/utils';

const HERO_TRANSLATIONS = [
  { text: 'Translate smarter.', lang: 'EN' },
  { text: 'Slimmer vertalen.', lang: 'NL' },
  { text: 'Schlauer übersetzen.', lang: 'DE' },
  { text: 'Traduire plus malin.', lang: 'FR' },
  { text: 'Traducir más inteligente.', lang: 'ES' },
  { text: 'もっと賢く翻訳。', lang: 'JA' },
  { text: 'Översätt smartare.', lang: 'SV' },
  { text: 'Tłumacz mądrzej.', lang: 'PL' },
  { text: '더 스마트하게 번역.', lang: 'KO' },
  { text: 'Daha akıllı çevir.', lang: 'TR' },
];

function getReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(getReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

export function HeroSection() {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % HERO_TRANSLATIONS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  return (
    <section className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-6 py-24">
      {/* Subtle animated grid background */}
      <AnimatedGridPattern
        numSquares={20}
        maxOpacity={0.06}
        duration={4}
        repeatDelay={1}
        className={cn(
          '[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]',
          'inset-x-0 inset-y-0 h-full',
        )}
      />

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-1 px-3 py-1 text-xs text-text-secondary"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-status-translated" />
          {t('Open source & free forever')}
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          className="text-4xl font-semibold leading-[1.1] tracking-tight text-text-primary sm:text-5xl md:text-6xl"
        >
          {t('Everything you need to ship translations')}
        </motion.h1>

        {/* Decorative rotating translations — showcases multilingual capability */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-4 flex items-center justify-center gap-2 text-lg text-text-tertiary"
        >
          <span className="inline-grid justify-center [&>*]:[grid-area:1/1]">
            {HERO_TRANSLATIONS.map((entry) => (
              <span key={entry.lang} className="invisible select-none" aria-hidden="true">
                {entry.text}
              </span>
            ))}
            <AnimatePresence mode="wait">
              <motion.span
                key={HERO_TRANSLATIONS[index].lang}
                initial={reducedMotion ? false : { opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -10, filter: 'blur(4px)' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                {HERO_TRANSLATIONS[index].text}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.div>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-text-secondary"
        >
          {t(
            'The browser-based translation platform with multi-provider AI, real-time collaboration, and one-click deploys to GitHub & GitLab.',
          )}
        </motion.p>

        {/* Provider line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-4 text-sm text-text-secondary"
        >
          {t('Powered by DeepL, Azure Translator & Google Gemini')}
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <Link
            to="/signup"
            className="rounded-md bg-text-primary px-6 py-2.5 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
          >
            {t('Start translating free')}
          </Link>
          <Link
            to="/editor"
            className="rounded-md border border-border-default px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-2"
          >
            {t('Try the editor')}
          </Link>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="mt-5 text-xs text-text-tertiary"
        >
          {t('No credit card required. Free for individuals.')}
        </motion.p>
      </div>
    </section>
  );
}
