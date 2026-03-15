import { Badge } from '@mantine/core';
import type { PlanTier } from '@/lib/billing/types';

const PLAN_COLORS: Record<PlanTier, string> = {
  free: 'gray',
  pro: 'blue',
  organization: 'violet',
};

const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  organization: 'Organization',
};

interface PlanBadgeProps {
  plan: PlanTier;
}

export function PlanBadge({ plan }: PlanBadgeProps) {
  return (
    <Badge variant="light" color={PLAN_COLORS[plan]} size="sm">
      {PLAN_LABELS[plan]}
    </Badge>
  );
}
