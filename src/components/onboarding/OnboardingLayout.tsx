/**
 * OnboardingLayout — shared wrapper for the onboarding wizard.
 * Centered container with logo and progress dots.
 *
 * Accepts a `wide` prop to expand the container for content-heavy steps
 * like the plan picker (which needs room for a 3-column grid).
 */

import { Container, Stack, useComputedColorScheme } from '@mantine/core';
import { cn } from '@/lib/utils';

interface ProgressDotsProps {
  current: number;
  total: number;
}

export function ProgressDots({ current, total }: ProgressDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-8 rounded-full transition-colors duration-200',
            i < current ? 'bg-accent' : 'bg-surface-3',
          )}
        />
      ))}
    </div>
  );
}

interface OnboardingLayoutProps {
  step: number;
  totalSteps: number;
  wide?: boolean;
  children: React.ReactNode;
}

export function OnboardingLayout({ step, totalSteps, wide, children }: OnboardingLayoutProps) {
  const computedColorScheme = useComputedColorScheme('light');

  return (
    <Container size={wide ? 960 : 520} py={60}>
      <Stack align="center" gap="lg">
        <img
          src={
            computedColorScheme === 'dark'
              ? '/glossboss-combined-light.svg'
              : '/glossboss-combined-dark.svg'
          }
          alt="GlossBoss"
          style={{ height: 32 }}
        />
        <ProgressDots current={step} total={totalSteps} />
        <div className="w-full">{children}</div>
      </Stack>
    </Container>
  );
}
