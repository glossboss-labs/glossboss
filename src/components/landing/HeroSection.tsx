import { Link } from 'react-router';
import { motion } from 'motion/react';
import { useTranslation } from '@/lib/app-language';
import { AnimatedGridPattern } from '@/components/magicui/animated-grid-pattern';
import { cn } from '@/lib/utils';

export function HeroSection() {
  const { t } = useTranslation();

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
          {t('Translate smarter.')}
          <br />
          <span className="text-text-tertiary">{t('Ship faster.')}</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-text-secondary"
        >
          {t(
            'The browser-based translation editor with multi-provider AI, real-time collaboration, and one-click deploys to GitHub.',
          )}
        </motion.p>

        {/* Provider line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-4 text-sm text-text-tertiary"
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
          {t('No credit card required. Free forever for individuals.')}
        </motion.p>
      </div>
    </section>
  );
}
