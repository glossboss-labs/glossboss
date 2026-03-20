import { getSupabaseClient } from '@/lib/supabase/client';
import type { OnboardingStatus, UserRole } from './types';

function supabase() {
  return getSupabaseClient('Onboarding');
}

async function getCurrentUserId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase().auth.getSession();

  if (session?.user.id) {
    return session.user.id;
  }

  const {
    data: { user },
  } = await supabase().auth.getUser();

  return user?.id ?? null;
}

/** Fetch the current user's onboarding status from their profile. */
export async function fetchOnboardingStatus(): Promise<OnboardingStatus | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase()
    .from('profiles')
    .select('onboarding_completed_at, role, full_name')
    .eq('id', userId)
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
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase()
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
}

/** Mark onboarding as complete. */
export async function completeOnboarding(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase()
    .from('profiles')
    .update({
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) throw error;
}
