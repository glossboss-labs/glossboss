import {
  SiWordpress,
  SiGithub,
  SiGitlab,
  SiDeepl,
  SiGooglegemini,
  SiElevenlabs,
} from '@icons-pack/react-simple-icons';
import { Cloud } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';

const tools: Array<{
  name: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}> = [
  { name: 'WordPress', Icon: SiWordpress },
  { name: 'GitHub', Icon: SiGithub },
  { name: 'GitLab', Icon: SiGitlab },
  { name: 'DeepL', Icon: SiDeepl },
  {
    name: 'Azure Translator',
    Icon: Cloud as React.ComponentType<{ size?: number; className?: string }>,
  },
  { name: 'Gemini', Icon: SiGooglegemini },
  { name: 'ElevenLabs', Icon: SiElevenlabs },
];

function ToolPill({
  name,
  Icon,
}: {
  name: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-md border border-border-subtle bg-surface-1 px-4 py-2">
      <Icon size={16} className="text-text-tertiary" />
      <span className="whitespace-nowrap text-sm text-text-secondary">{name}</span>
    </div>
  );
}

export function SocialProofBar() {
  const { t } = useTranslation();

  return (
    <section className="border-y border-border-subtle py-8">
      <p className="mb-5 text-center text-xs font-medium uppercase tracking-widest text-text-tertiary">
        {t('Integrates with your favorite tools')}
      </p>
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-surface-0 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-surface-0 to-transparent" />

        <div className="flex w-max gap-3" style={{ animation: 'marquee 40s linear infinite' }}>
          {[0, 1, 2, 3].map((set) =>
            tools.map((tool, j) => (
              <ToolPill key={`${set}-${j}`} name={tool.name} Icon={tool.Icon} />
            )),
          )}
        </div>
      </div>
    </section>
  );
}
