import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation, msgid } from '@/lib/app-language';
import { cn } from '@/lib/utils';

const faqs = [
  {
    q: msgid('Is GlossBoss really free?'),
    a: msgid(
      'The local editor is free with no limits — open any PO, POT, or JSON file and translate without an account. Cloud features like saved projects, team collaboration, and repo sync start with a free tier (1 project, 5,000 strings) and scale from there.',
    ),
  },
  {
    q: msgid('What file formats does it support?'),
    a: msgid(
      'GlossBoss supports gettext PO/POT files and i18next JSON resources. These cover WordPress plugins and themes, React and JavaScript apps, and most open-source projects.',
    ),
  },
  {
    q: msgid('Which translation providers are supported?'),
    a: msgid(
      'Seven providers: DeepL, OpenAI, Claude, Google Gemini, Mistral, DeepSeek, and Azure Translator — plus custom endpoints for self-hosted LLMs. You can switch between configured providers from the editor when the current project is not locked to an organization or language-level override, and you can always manage provider setup in Settings.',
    ),
  },
  {
    q: msgid('How is this different from Poedit or Crowdin?'),
    a: msgid(
      'GlossBoss combines the simplicity of Poedit with the collaboration features of Crowdin — in the browser, with no install required. It supports seven AI translation providers including DeepL, OpenAI, Claude, and Gemini, has deep WordPress integration with source-code context, includes a full review workflow with threaded comments, syncs directly with GitHub and GitLab, and is open source.',
    ),
  },
  {
    q: msgid('Is my data safe?'),
    a: msgid(
      'GlossBoss uses no cookies and collects no personal data for analytics — not even your email or IP address. Files opened in the local editor are processed entirely in your browser and never sent to our servers. Cloud projects are stored in Supabase with encrypted credentials. The entire codebase is open source for inspection.',
    ),
  },
  {
    q: msgid('Can I self-host GlossBoss?'),
    a: msgid(
      'Yes. GlossBoss is licensed under AGPL-3.0 and the full source code is on GitHub. You can run your own instance for your team or organization.',
    ),
  },
  {
    q: msgid('What makes the WordPress integration special?'),
    a: msgid(
      'GlossBoss can load glossaries directly from WordPress.org for any plugin or theme, browse the actual plugin source files via SVN, and use Google Gemini to read your source code for context-aware translations — so the AI understands where each string appears in your UI.',
    ),
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="border-b border-border-subtle">
      <button
        className="flex w-full items-center justify-between py-5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-medium text-text-primary">{t(q)}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-text-tertiary transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-text-secondary">{t(a)}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FAQSection() {
  const { t } = useTranslation();

  return (
    <section className="bg-surface-1 px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          {t('Frequently asked questions')}
        </h2>
        <div>
          {faqs.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
