import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ExternalLink,
  Filter,
  RotateCcw,
  Search,
  Square,
  Volume2,
  Zap,
} from 'lucide-react';
import { BorderBeam } from '@/components/magicui/border-beam';

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

interface DemoEntry {
  id: number;
  source: string;
  translation: string;
  initialStatus: 'translated' | 'fuzzy' | 'untranslated';
}

const DEMO_ENTRIES: DemoEntry[] = [
  {
    id: 1,
    source: 'Admin and Site Enhancements (ASE) Pro',
    translation: 'Admin and Site Enhancements (ASE) Pro',
    initialStatus: 'translated',
  },
  {
    id: 2,
    source: 'Easily enable enhancements and features that usually require multiple plugins.',
    translation:
      'Eenvoudig verbeteringen en functies inschakelen waarvoor meestal meerdere plugins nodig zijn.',
    initialStatus: 'translated',
  },
  {
    id: 3,
    source: 'Enable or disable the modules you need.',
    translation: 'Schakel de modules in of uit die je nodig hebt.',
    initialStatus: 'fuzzy',
  },
  {
    id: 4,
    source: 'Content Management',
    translation: 'Inhoudsbeheer',
    initialStatus: 'untranslated',
  },
  {
    id: 5,
    source: 'Media Library Management',
    translation: 'Mediabibliothekbeheer',
    initialStatus: 'untranslated',
  },
  {
    id: 6,
    source: 'Custom Code Manager',
    translation: 'Aangepaste codebeheerder',
    initialStatus: 'untranslated',
  },
];

const STATUS_STYLE = {
  translated: 'bg-status-translated',
  fuzzy: 'bg-status-fuzzy',
  untranslated: 'bg-status-untranslated',
} as const;

const STATUS_LABEL = {
  translated: 'TRANSLATED',
  fuzzy: 'FUZZY',
  untranslated: 'UNTRANSLATED',
} as const;

// ---------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Browser TTS
// ---------------------------------------------------------------------------

function DemoSpeakButton({ text, lang }: { text: string; lang: string }) {
  const [playing, setPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!('speechSynthesis' in window)) return;

      if (playing) {
        window.speechSynthesis.cancel();
        setPlaying(false);
        return;
      }

      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 1;
      u.onend = () => setPlaying(false);
      u.onerror = () => setPlaying(false);
      utteranceRef.current = u;

      window.speechSynthesis.cancel();
      setPlaying(true);
      window.speechSynthesis.speak(u);
    },
    [text, lang, playing],
  );

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (playing) window.speechSynthesis?.cancel();
    };
  }, [playing]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mt-0.5 shrink-0 text-text-tertiary/40 transition-colors hover:text-text-secondary"
      aria-label={playing ? 'Stop speaking' : `Listen to "${text.slice(0, 30)}"`}
    >
      {playing ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductShowcase() {
  const reducedMotion = useReducedMotion();
  const [translatedIds, setTranslatedIds] = useState<Set<number>>(new Set());
  const [animatingId, setAnimatingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number>(1);

  const untranslatedEntries = useMemo(
    () => DEMO_ENTRIES.filter((e) => e.initialStatus === 'untranslated'),
    [],
  );

  const stats = useMemo(() => {
    const translated =
      DEMO_ENTRIES.filter((e) => e.initialStatus === 'translated').length + translatedIds.size;
    const total = DEMO_ENTRIES.length;
    const untranslatedLeft = untranslatedEntries.filter((e) => !translatedIds.has(e.id)).length;
    const pct = Math.round((translated / total) * 100);
    return { translated, total, untranslatedLeft, pct };
  }, [translatedIds, untranslatedEntries]);

  const allDone = stats.untranslatedLeft === 0;

  function handleTranslateRow(id: number) {
    if (animatingId !== null || translatedIds.has(id)) return;
    setSelectedId(id);
    setAnimatingId(id);
    setTimeout(() => {
      setTranslatedIds((prev) => new Set(prev).add(id));
      setAnimatingId(null);
    }, 600);
  }

  function handleTranslateAll() {
    if (animatingId !== null) return;
    const remaining = untranslatedEntries.filter((e) => !translatedIds.has(e.id));
    if (remaining.length === 0) return;
    remaining.forEach((entry, offset) => {
      setTimeout(() => {
        setSelectedId(entry.id);
        setAnimatingId(entry.id);
        setTimeout(() => {
          setTranslatedIds((prev) => new Set(prev).add(entry.id));
          setAnimatingId(null);
        }, 450);
      }, offset * 600);
    });
  }

  function handleReset() {
    setTranslatedIds(new Set());
    setAnimatingId(null);
    setSelectedId(1);
  }

  function getStatus(entry: DemoEntry): 'translated' | 'fuzzy' | 'untranslated' {
    if (reducedMotion && entry.translation) return 'translated';
    if (entry.initialStatus !== 'untranslated') return entry.initialStatus;
    if (translatedIds.has(entry.id)) return 'translated';
    return 'untranslated';
  }

  function getTranslation(entry: DemoEntry): string {
    if (reducedMotion) return entry.translation;
    if (entry.initialStatus !== 'untranslated') return entry.translation;
    if (translatedIds.has(entry.id) || animatingId === entry.id) return entry.translation;
    return '';
  }

  const progressColor =
    stats.pct === 100 ? 'bg-status-translated' : stats.pct > 50 ? 'bg-accent' : 'bg-status-fuzzy';

  return (
    <section className="px-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="mx-auto max-w-5xl"
      >
        <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface-0 shadow-2xl">
          {/* ── Window chrome ──────────────────────────────── */}
          <div className="flex h-10 items-center border-b border-border-subtle bg-surface-1 px-4">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <div className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <div className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="mx-auto flex items-center gap-1.5 rounded-md bg-surface-2 px-3 py-1">
              <span className="text-[11px] text-text-tertiary">glossboss.ink/editor</span>
            </div>
            <Link
              to="/editor"
              className="flex items-center gap-1 text-[11px] text-text-tertiary transition-colors hover:text-text-secondary"
            >
              Try it
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {/* ── File header ────────────────────────────────── */}
          <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-2.5">
            <span className="text-sm font-semibold text-text-primary">example.po</span>
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              NL
            </span>
            <span className="ml-auto text-xs text-text-tertiary">{stats.total} entries</span>
          </div>

          {/* ── Edit workspace ─────────────────────────────── */}
          <div className="border-b border-border-subtle bg-surface-1 px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="flex flex-1 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-0 px-2.5 py-1.5 sm:max-w-[280px]">
                <Search className="h-3.5 w-3.5 text-text-tertiary" />
                <span className="text-xs text-text-tertiary">
                  Search source, translation, context...
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                <Filter className="h-3 w-3" />
                <span>Filters</span>
              </div>

              {/* Progress */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs tabular-nums text-text-tertiary">
                  {stats.translated}/{stats.total}
                </span>
                <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-3 sm:block">
                  <motion.div
                    className={`h-full rounded-full ${progressColor}`}
                    animate={{ width: `${stats.pct}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-xs font-medium tabular-nums text-text-tertiary">
                  {stats.pct}%
                </span>
              </div>
            </div>
          </div>

          {/* ── Translate toolbar ──────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-4 py-2">
            <span className="text-xs text-text-tertiary">From</span>
            <span className="rounded-md border border-border-subtle bg-surface-1 px-2 py-1 text-xs text-text-secondary">
              Auto-detect
            </span>
            <ArrowRight className="h-3 w-3 text-text-tertiary" />
            <span className="text-xs text-text-tertiary">To</span>
            <span className="rounded-md border border-border-subtle bg-surface-1 px-2 py-1 text-xs text-text-secondary">
              Dutch
            </span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-text-tertiary">
              DETECTED: NL
            </span>

            <div className="ml-auto">
              {allDone ? (
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-2"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset demo
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleTranslateAll}
                  className="flex items-center gap-1.5 rounded-md bg-status-translated/15 px-3 py-1.5 text-xs font-medium text-status-translated transition-colors hover:bg-status-translated/25"
                >
                  <Zap className="h-3 w-3" />
                  Translate {stats.untranslatedLeft} untranslated
                </button>
              )}
            </div>
          </div>

          {/* ── Table ──────────────────────────────────────── */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '36px' }} />
                <col style={{ width: '18%' }} />
                <col />
                <col />
              </colgroup>

              <thead>
                <tr className="bg-surface-2/80">
                  <th className="px-2 py-2.5">
                    <div className="flex justify-center">
                      <div className="h-4 w-4 rounded border border-border-default bg-surface-1" />
                    </div>
                  </th>
                  {['STATUS', 'SOURCE STRING', 'TRANSLATED STRING'].map((label) => (
                    <th
                      key={label}
                      className="px-3 py-2.5 text-[11px] font-medium tracking-[0.04em] text-text-tertiary"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-border-subtle/50">
                {DEMO_ENTRIES.map((entry) => {
                  const status = getStatus(entry);
                  const translation = getTranslation(entry);
                  const isActive = animatingId === entry.id;
                  const isSelected = selectedId === entry.id;
                  const isUntranslated =
                    entry.initialStatus === 'untranslated' && !translatedIds.has(entry.id);

                  return (
                    <tr
                      key={entry.id}
                      onClick={() => setSelectedId(entry.id)}
                      className={[
                        'transition-colors duration-150 cursor-pointer',
                        isActive
                          ? 'bg-accent/5'
                          : isSelected
                            ? 'bg-[var(--gb-highlight-row,rgba(0,0,0,0.03))]'
                            : isUntranslated
                              ? 'bg-[var(--gb-highlight-danger,rgba(239,68,68,0.04))]'
                              : '',
                        'hover:bg-[var(--gb-highlight-row,rgba(0,0,0,0.03))]',
                      ].join(' ')}
                    >
                      {/* Checkbox */}
                      <td className="px-2 py-3 align-top">
                        <div className="flex justify-center pt-0.5">
                          <div className="h-4 w-4 rounded border border-border-default bg-surface-1" />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold leading-none tracking-wide text-white ${STATUS_STYLE[status]}`}
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      </td>

                      {/* Source */}
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <span className="flex-1 text-[13px] leading-relaxed text-text-primary">
                            {entry.source}
                          </span>
                          <DemoSpeakButton text={entry.source} lang="en" />
                        </div>
                      </td>

                      {/* Translation */}
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-start gap-2">
                          <div className="min-h-[1.25rem] flex-1">
                            {translation ? (
                              <motion.span
                                initial={
                                  isActive && !reducedMotion
                                    ? { opacity: 0, filter: 'blur(6px)' }
                                    : false
                                }
                                animate={{ opacity: 1, filter: 'blur(0px)' }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className="inline-block text-[13px] leading-relaxed text-text-primary"
                              >
                                {translation}
                              </motion.span>
                            ) : (
                              <span className="text-[13px] italic text-text-tertiary/20">
                                &mdash;
                              </span>
                            )}
                          </div>
                          {isUntranslated ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTranslateRow(entry.id);
                              }}
                              disabled={animatingId !== null}
                              className="mt-0.5 shrink-0 text-accent transition-colors hover:text-accent/80 disabled:opacity-30"
                              aria-label={`Translate "${entry.source}"`}
                            >
                              <Zap className="h-3.5 w-3.5" />
                            </button>
                          ) : translation ? (
                            <DemoSpeakButton text={translation} lang="nl" />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Footer ─────────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-border-subtle px-4 py-1.5">
            <span className="text-[10px] text-text-tertiary">
              Showing {stats.total} of {stats.total}
            </span>
            <span className="text-[10px] text-text-tertiary">Page 1 of 1</span>
          </div>

          <BorderBeam
            size={200}
            duration={10}
            colorFrom="#3b82f6"
            colorTo="#8b5cf6"
            borderWidth={1}
          />
        </div>
      </motion.div>
    </section>
  );
}
