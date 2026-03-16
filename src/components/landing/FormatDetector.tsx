import { useCallback, useRef, useState } from 'react';
import { CheckCircle, Clock, FileQuestion } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation, msgid } from '@/lib/app-language';

type ResultKind = 'supported' | 'coming-soon' | 'unsupported';

interface DetectionResult {
  kind: ResultKind;
  filename: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.po', '.pot', '.json']);
const COMING_SOON_EXTENSIONS = new Set(['.xliff', '.xlf', '.csv']);

const messages: Record<ResultKind, string> = {
  supported: msgid('GlossBoss supports this format!'),
  'coming-soon': msgid("Coming soon — we're working on this format"),
  unsupported: msgid(
    "This format isn't supported yet. GlossBoss works with PO, POT, and i18next JSON files.",
  ),
};

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function detectFormat(filename: string): ResultKind {
  const ext = getExtension(filename);
  if (SUPPORTED_EXTENSIONS.has(ext)) return 'supported';
  if (COMING_SOON_EXTENSIONS.has(ext)) return 'coming-soon';
  return 'unsupported';
}

const resultStyles: Record<ResultKind, { icon: typeof CheckCircle; color: string }> = {
  supported: { icon: CheckCircle, color: 'text-status-translated' },
  'coming-soon': { icon: Clock, color: 'text-amber-500' },
  unsupported: { icon: FileQuestion, color: 'text-text-tertiary' },
};

export function FormatDetector() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setResult({ kind: detectFormat(file.name), filename: file.name });
  }, []);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult({ kind: detectFormat(file.name), filename: file.name });
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const reset = useCallback(() => {
    setResult(null);
  }, []);

  const Icon = result ? resultStyles[result.kind].icon : null;
  const iconColor = result ? resultStyles[result.kind].color : '';

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-xl">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            {t('Check file compatibility')}
          </h2>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".po,.pot,.json,.xliff,.xlf,.csv"
          onChange={onFileSelect}
          className="hidden"
        />
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={openFilePicker}
          className={`relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
            dragOver
              ? 'border-accent bg-accent/5'
              : 'border-border-subtle bg-surface-1 hover:border-border-default'
          } p-8`}
        >
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-center"
              >
                <p className="text-sm text-text-secondary">
                  {t('Drop a file to check compatibility, or click to browse')}
                </p>
                <p className="mt-2 text-xs text-text-tertiary">
                  {t('.po, .pot, .json, .xliff, .csv, or any file')}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center gap-3 text-center"
              >
                {Icon && <Icon className={`h-8 w-8 ${iconColor}`} strokeWidth={1.5} />}
                <p className="text-sm font-medium text-text-primary">{result.filename}</p>
                <p className="text-sm text-text-secondary">{t(messages[result.kind])}</p>
                <button
                  type="button"
                  onClick={reset}
                  className="mt-2 text-xs text-accent underline-offset-2 hover:underline"
                >
                  {t('Try another file')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
