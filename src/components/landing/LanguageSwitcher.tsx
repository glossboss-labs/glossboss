import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { Globe, ChevronDown } from 'lucide-react';
import { APP_LANGUAGE_OPTIONS, useTranslation, type AppLanguage } from '@/lib/app-language';
import { cn } from '@/lib/utils';

function langHref(lang: string): string {
  return lang === 'en' ? '/' : `/${lang}`;
}

export function LanguageSwitcher({
  currentLang,
  size = 'sm',
}: {
  currentLang: string;
  size?: 'sm' | 'base';
}) {
  const { setLanguage } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentOption = APP_LANGUAGE_OPTIONS.find((o) => o.value === currentLang);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 text-text-secondary transition-colors hover:text-text-primary',
          size === 'sm' ? 'text-xs' : 'text-sm',
        )}
      >
        <Globe className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        <span>{currentOption?.label ?? currentLang}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[140px] overflow-hidden rounded-lg border border-border-subtle bg-surface-0 py-1 shadow-lg">
          {APP_LANGUAGE_OPTIONS.map((option) => (
            <Link
              key={option.value}
              to={langHref(option.value)}
              onClick={() => {
                setLanguage(option.value as AppLanguage);
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-surface-2',
                currentLang === option.value
                  ? 'font-medium text-text-primary'
                  : 'text-text-secondary',
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
