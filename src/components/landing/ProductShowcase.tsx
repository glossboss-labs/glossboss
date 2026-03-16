import { motion } from 'motion/react';
import { BorderBeam } from '@/components/magicui/border-beam';

export function ProductShowcase() {
  return (
    <section className="px-6 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="mx-auto max-w-4xl"
      >
        <div className="relative overflow-hidden rounded-lg border border-border-subtle bg-surface-1 shadow-xl">
          {/* Title bar */}
          <div className="flex h-9 items-center gap-2 border-b border-border-subtle px-4">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-text-tertiary/30" />
              <div className="h-2.5 w-2.5 rounded-full bg-text-tertiary/30" />
              <div className="h-2.5 w-2.5 rounded-full bg-text-tertiary/30" />
            </div>
            <div className="mx-auto text-xs text-text-tertiary">glossboss.ink/editor</div>
          </div>

          {/* Editor mockup */}
          <div className="h-80 grid grid-cols-[180px_1fr] divide-x divide-border-subtle">
            {/* Sidebar */}
            <div className="flex flex-col gap-3 p-4">
              <div className="h-3 w-20 rounded bg-surface-3" />
              <div className="h-2.5 w-28 rounded bg-surface-2" />
              <div className="mt-2 h-2.5 w-24 rounded bg-surface-2/60" />
              <div className="h-2.5 w-32 rounded bg-surface-2/60" />
              <div className="h-2.5 w-16 rounded bg-surface-2/60" />
            </div>

            {/* Editor */}
            <div className="flex flex-col">
              {/* Toolbar */}
              <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-2">
                <div className="h-3 w-3 rounded bg-accent/40" />
                <div className="h-2.5 w-16 rounded bg-surface-3" />
                <div className="ml-auto h-5 w-14 rounded bg-accent/20" />
              </div>

              {/* Rows */}
              <div className="flex flex-col divide-y divide-border-subtle/50">
                {[
                  { s: 'bg-status-translated', sw: '60%', tw: '55%', o: 1 },
                  { s: 'bg-status-translated', sw: '45%', tw: '50%', o: 0.9 },
                  { s: 'bg-status-translated', sw: '70%', tw: '60%', o: 0.85 },
                  { s: 'bg-status-translated', sw: '50%', tw: '45%', o: 0.8 },
                  { s: 'bg-status-fuzzy', sw: '55%', tw: '40%', o: 0.7 },
                  { s: 'bg-status-fuzzy', sw: '65%', tw: '50%', o: 0.6 },
                  { s: 'bg-status-untranslated', sw: '48%', tw: '0%', o: 0.5 },
                ].map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ opacity: row.o }}
                  >
                    <div className={`h-2 w-2 shrink-0 rounded-full ${row.s}`} />
                    <div className="h-2.5 rounded bg-surface-3" style={{ width: row.sw }} />
                    <div className="h-2.5 rounded bg-border-subtle" style={{ width: row.tw }} />
                  </div>
                ))}
              </div>
            </div>
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
