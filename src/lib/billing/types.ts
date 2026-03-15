export type PlanTier = 'free' | 'pro' | 'organization';

export type BillingInterval = 'month' | 'year';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'revoked';

export interface PlanLimits {
  projects: number;
  strings: number;
  members: number;
}

export interface SubscriptionRow {
  id: string;
  user_id: string | null;
  organization_id: string | null;
  polar_subscription_id: string | null;
  polar_customer_id: string | null;
  polar_product_id: string | null;
  plan: PlanTier;
  billing_interval: BillingInterval | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanUsage {
  projects: number;
  strings: number;
  members: number;
}

export interface PlanInfo {
  tier: PlanTier;
  limits: PlanLimits;
  usage: PlanUsage;
}
