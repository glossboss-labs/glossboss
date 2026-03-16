import { Alert, Button, Group, Text } from '@mantine/core';
import { Zap } from 'lucide-react';
import { useTranslation } from '@/lib/app-language';
import type { PlanTier } from '@/lib/billing/types';
import { POLAR_PRODUCT_IDS } from '@/lib/billing/polar';
import { createCheckoutSession } from '@/lib/billing/api';

interface UpgradePromptProps {
  /** The resource that hit the limit. */
  resource: 'projects' | 'strings' | 'members';
  /** Current plan tier. */
  currentPlan: PlanTier;
}

const RESOURCE_MESSAGES: Record<string, string> = {
  projects: 'You have reached the project limit on your current plan.',
  strings: 'You have reached the string limit on your current plan.',
  members: 'You have reached the member limit on your current plan.',
};

export function UpgradePrompt({ resource, currentPlan }: UpgradePromptProps) {
  const { t } = useTranslation();

  const suggestedPlan: Exclude<PlanTier, 'free'> =
    currentPlan === 'free' || currentPlan === 'flex' ? 'pro' : 'organization';

  const productId = POLAR_PRODUCT_IDS[suggestedPlan].month!;

  const handleUpgrade = async () => {
    try {
      const url = await createCheckoutSession(productId);
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to create checkout session:', err);
    }
  };

  return (
    <Alert color="yellow" icon={<Zap size={16} />}>
      <Group justify="space-between" align="center" wrap="wrap">
        <Text size="sm">{t(RESOURCE_MESSAGES[resource])}</Text>
        <Button
          size="xs"
          variant="filled"
          color="blue"
          leftSection={<Zap size={14} />}
          onClick={handleUpgrade}
        >
          {t('Upgrade to {{plan}}', {
            plan: suggestedPlan === 'pro' ? 'Pro' : 'Organization',
          })}
        </Button>
      </Group>
    </Alert>
  );
}
