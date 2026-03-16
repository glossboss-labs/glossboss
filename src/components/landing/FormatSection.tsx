import { useTranslation } from '@/lib/app-language';

const poExample = `msgid "Add to cart"
msgstr "In den Warenkorb"

msgid "Checkout"
msgstr "Zur Kasse"

msgid "%d item"
msgid_plural "%d items"
msgstr[0] "%d Artikel"
msgstr[1] "%d Artikel"`;

const jsonExample = `{
  "welcome": "Willkommen",
  "cart": {
    "add": "In den Warenkorb",
    "checkout": "Zur Kasse",
    "items_one": "{{count}} Artikel",
    "items_other": "{{count}} Artikel"
  }
}`;

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-0 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-status-translated" />
        <span className="text-xs font-medium text-text-secondary">{title}</span>
      </div>
      <pre className="overflow-x-auto p-5 text-sm leading-relaxed text-text-primary">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function FormatSection() {
  const { t } = useTranslation();

  return (
    <section className="border-y border-border-subtle bg-surface-1 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            {t('Every format, one editor')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-text-secondary">
            {t(
              'Edit gettext PO/POT files and i18next JSON resources in the same familiar interface.',
            )}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <CodeBlock title="translations.po" code={poExample} />
          <CodeBlock title="en/translation.json" code={jsonExample} />
        </div>
      </div>
    </section>
  );
}
