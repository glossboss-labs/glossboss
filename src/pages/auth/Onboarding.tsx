/**
 * Onboarding — multi-step wizard for new users.
 *
 * Steps: Profile → Role → Plan → Attribution → Done
 *
 * Handles resumption after Polar checkout via ?step=attribution query param.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { trackEvent } from '@/lib/analytics';
import { updateOnboardingProfile, completeOnboarding } from '@/lib/onboarding/api';
import type { UserRole, AttributionSource } from '@/lib/onboarding/types';
import type { PlanTier } from '@/lib/billing/types';
import { OnboardingLayout } from '@/components/onboarding/OnboardingLayout';
import { ProfileStep } from '@/components/onboarding/ProfileStep';
import { RoleStep } from '@/components/onboarding/RoleStep';
import { PlanStep } from '@/components/onboarding/PlanStep';
import { AttributionStep } from '@/components/onboarding/AttributionStep';

type Step = 'profile' | 'role' | 'plan' | 'attribution';

const STEPS: Step[] = ['profile', 'role', 'plan', 'attribution'];
const TOTAL_STEPS = STEPS.length;

function getInitialStep(searchParams: URLSearchParams): Step {
  const stepParam = searchParams.get('step');
  if (stepParam === 'attribution') return 'attribution';
  return 'profile';
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const startTime = useRef(0);
  const [step, setStep] = useState<Step>(() => getInitialStep(searchParams));
  const [role, setRole] = useState<UserRole | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('free');

  const preselectedPlan = searchParams.get('plan');
  const preselectedInterval = searchParams.get('interval');

  const stepIndex = STEPS.indexOf(step);

  const authMethod = user?.app_metadata?.provider === 'github' ? 'github' : 'email';

  // Track onboarding start on mount
  useEffect(() => {
    startTime.current = Date.now();
    trackEvent('onboarding_started', { method: authMethod });
  }, [authMethod]);

  const handleProfileDone = useCallback(async (fullName: string) => {
    if (fullName) {
      try {
        await updateOnboardingProfile({ full_name: fullName });
      } catch {
        // Non-blocking — continue onboarding even if profile update fails
      }
    }
    trackEvent('onboarding_profile_completed', { has_name: Boolean(fullName) });
    setStep('role');
  }, []);

  const handleRoleDone = useCallback(async (selectedRole: UserRole) => {
    setRole(selectedRole);
    try {
      await updateOnboardingProfile({ role: selectedRole });
    } catch {
      // Non-blocking
    }
    trackEvent('onboarding_role_selected', { role: selectedRole });
    setStep('plan');
  }, []);

  const handlePlanDone = useCallback(
    (plan: PlanTier, interval: string) => {
      setSelectedPlan(plan);
      trackEvent('onboarding_plan_selected', {
        plan,
        interval,
        was_preselected: Boolean(preselectedPlan),
      });
      // For paid plans, the user was redirected to Polar checkout and returns
      // with ?step=attribution. For free, we advance directly.
      setStep('attribution');
    },
    [preselectedPlan],
  );

  const handleAttributionDone = useCallback(
    async (source: AttributionSource | null) => {
      if (source) {
        trackEvent('onboarding_attribution', { source });
      }

      try {
        await completeOnboarding();
      } catch {
        // Non-blocking — worst case, they see onboarding again next time
      }

      const durationSeconds = Math.round((Date.now() - startTime.current) / 1000);
      trackEvent('onboarding_completed', {
        role,
        plan: selectedPlan,
        duration_seconds: durationSeconds,
      });

      navigate('/settings?tab=translation&tour=settings', { replace: true });
    },
    [navigate, role, selectedPlan],
  );

  return (
    <OnboardingLayout step={stepIndex + 1} totalSteps={TOTAL_STEPS} wide={step === 'plan'}>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25 }}
        >
          {step === 'profile' && <ProfileStep onNext={handleProfileDone} />}
          {step === 'role' && <RoleStep onNext={handleRoleDone} />}
          {step === 'plan' && (
            <PlanStep
              role={role}
              preselectedPlan={preselectedPlan}
              preselectedInterval={preselectedInterval}
              onNext={handlePlanDone}
            />
          )}
          {step === 'attribution' && <AttributionStep onNext={handleAttributionDone} />}
        </motion.div>
      </AnimatePresence>
    </OnboardingLayout>
  );
}
