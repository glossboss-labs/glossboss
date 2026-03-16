import { Link } from 'react-router';
import { motion } from 'motion/react';
import { useTranslation } from '@/lib/app-language';

export function FinalCTA() {
  const { t } = useTranslation();

  return (
    <section className="border-t border-border-subtle bg-surface-2 px-6 py-24">
      <motion.div
        initial={{ opacity: 0.2, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-2xl text-center"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          {t('Start translating today')}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-text-secondary">
          {t('Free forever. Upgrade when you are ready.')}
        </p>
        <div className="mt-8">
          <Link
            to="/signup"
            className="inline-block rounded-md bg-text-primary px-8 py-3 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
          >
            {t('Get started free')}
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
