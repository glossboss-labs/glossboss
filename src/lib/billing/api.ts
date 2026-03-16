import { getSupabaseClient } from '@/lib/supabase/client';
import type { SubscriptionRow } from './types';

function supabase() {
  return getSupabaseClient('Billing');
}

/** Create a Polar checkout session and return the checkout URL. */
export async function createCheckoutSession(
  productId: string,
  successUrl?: string,
): Promise<string> {
  const client = getSupabaseClient('Billing');
  const { data, error } = await client.functions.invoke('polar-checkout', {
    body: { productId, successUrl },
  });

  if (error) throw error;
  if (!data?.url) throw new Error('No checkout URL returned');
  return data.url;
}

/** Fetch the current user's personal subscription. */
export async function getUserSubscription(): Promise<SubscriptionRow | null> {
  const {
    data: { user },
  } = await supabase().auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase()
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Fetch the subscription for an organization. */
export async function getOrgSubscription(orgId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase()
    .from('subscriptions')
    .select('*')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
