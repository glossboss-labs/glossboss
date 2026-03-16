import { getSupabaseClient } from '@/lib/supabase/client';
import type { OnboardingStatus, UserRole } from './types';

function supabase() {
  return getSupabaseClient('Onboarding');
}

/** Fetch the current user's onboarding status from their profile. */
export async function fetchOnboardingStatus(): Promise<OnboardingStatus | null> {
  const {
    data: { user },
  } = await supabase().auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase()
    .from('profiles')
    .select('onboarding_completed_at, role, full_name')
    .eq('id', user.id)
    .single();

  if (error) throw error;

  return {
    onboardingCompletedAt: data.onboarding_completed_at,
    role: data.role as UserRole | null,
    fullName: data.full_name,
  };
}

/** Update the user's profile with onboarding data. */
export async function updateOnboardingProfile(fields: {
  full_name?: string;
  role?: UserRole;
}): Promise<void> {
  const {
    data: { user },
  } = await supabase().auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase()
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) throw error;
}

/** Mark onboarding as complete. */
export async function completeOnboarding(): Promise<void> {
  const {
    data: { user },
  } = await supabase().auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase()
    .from('profiles')
    .update({
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) throw error;
}
