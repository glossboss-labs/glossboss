import { Github, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from '@/lib/app-language';

export function OpenSourceSection() {
  const { t } = useTranslation();

  return (
    <section className="px-6 py-16">
      <motion.div
        initial={{ opacity: 0.2, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '0px' }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-2xl text-center"
      >
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-lg border border-border-subtle bg-surface-1">
          <Github className="h-5 w-5 text-text-secondary" strokeWidth={1.5} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          {t('Open source. Built in the open.')}
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-text-secondary">
          {t(
            'GlossBoss is AGPL-3.0 licensed. Inspect the code, self-host it, or contribute. No vendor lock-in — your translations stay in standard PO and JSON formats.',
          )}
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <a
            href="https://github.com/glossboss-labs/glossboss"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border-default px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-2"
          >
            <Github className="h-4 w-4" />
            {t('View on GitHub')}
          </a>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
          <Heart className="h-3 w-3" />
          {t('Crafted with care in the Netherlands')}
        </p>
      </motion.div>
    </section>
  );
}
