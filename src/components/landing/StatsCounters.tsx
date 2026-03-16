import { useEffect, useRef, useState } from 'react';
import { useInView, useMotionValue, useSpring } from 'motion/react';
import { useTranslation, msgid } from '@/lib/app-language';
import { invokeSupabaseFunction } from '@/lib/supabase/client';

interface PlatformStats {
  totalStrings: number;
  totalProjects: number;
  totalMembers: number;
  totalLanguages: number;
}

function AnimatedNumber({ value, suffix }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: '0px' });

  useEffect(() => {
    if (isInView && value > 0) {
      motionValue.set(value);
    }
  }, [isInView, motionValue, value]);

  useEffect(
    () =>
      springValue.on('change', (latest) => {
        if (ref.current) {
          const rounded = Math.round(latest);
          ref.current.textContent = `${rounded.toLocaleString()}${suffix ?? ''}`;
        }
      }),
    [springValue, suffix],
  );

  return (
    <span ref={ref} className="inline-block tabular-nums text-text-primary">
      0{suffix ?? ''}
    </span>
  );
}

const STAT_LABELS = {
  totalStrings: msgid('strings translated'),
  totalProjects: msgid('projects created'),
  totalMembers: msgid('members'),
  totalLanguages: msgid('languages'),
};

export function StatsCounters() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<PlatformStats | null>(null);

  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function load() {
      try {
        const { data } = await invokeSupabaseFunction<{ ok: boolean; stats: PlatformStats }>(
          'platform-stats',
          { featureLabel: 'Platform stats' },
        );
        if (data?.ok && data.stats) {
          setStats(data.stats);
        }
      } catch {
        // Silently fail — counters won't show
      }
    }
    void load();
  });

  // Don't render if no data or all zeros
  if (!stats || (stats.totalStrings === 0 && stats.totalProjects === 0)) {
    return null;
  }

  const counters = [
    { value: stats.totalStrings, label: STAT_LABELS.totalStrings, suffix: '+' },
    { value: stats.totalProjects, label: STAT_LABELS.totalProjects, suffix: '+' },
    { value: stats.totalMembers, label: STAT_LABELS.totalMembers, suffix: '+' },
    { value: stats.totalLanguages, label: STAT_LABELS.totalLanguages, suffix: '+' },
  ].filter((c) => c.value > 0);

  if (counters.length === 0) return null;

  return (
    <section className="px-6 py-16">
      <div
        className="mx-auto grid max-w-3xl gap-8"
        style={{ gridTemplateColumns: `repeat(${counters.length}, minmax(0, 1fr))` }}
      >
        {counters.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="text-4xl font-bold tracking-tight sm:text-5xl">
              <AnimatedNumber value={stat.value} suffix={stat.suffix} />
            </p>
            <p className="mt-2 text-sm text-text-secondary">{t(stat.label)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
