/**
 * Polar Webhook Edge Function
 *
 * Receives subscription lifecycle events from Polar.sh and upserts
 * subscription state in the `subscriptions` table.
 *
 * Uses the Supabase service role key to bypass RLS for writes.
 * Validates webhook signatures using the Standard Webhooks spec.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Standard Webhooks signature verification
// ---------------------------------------------------------------------------

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60; // 5 minutes

async function verifyWebhookSignature(
  body: string,
  headers: Headers,
  secret: string,
): Promise<void> {
  const webhookId = headers.get('webhook-id');
  const webhookTimestamp = headers.get('webhook-timestamp');
  const webhookSignature = headers.get('webhook-signature');

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    throw new Error('Missing webhook signature headers');
  }

  // Verify timestamp is within tolerance
  const timestamp = parseInt(webhookTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    throw new Error('Webhook timestamp outside tolerance');
  }

  // Standard Webhooks: secret is prefixed with "whsec_" and base64-encoded
  const secretBytes = base64Decode(secret.startsWith('whsec_') ? secret.slice(6) : secret);

  // Signature content: "{webhook-id}.{webhook-timestamp}.{body}"
  const signatureContent = `${webhookId}.${webhookTimestamp}.${body}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureContent));

  const expectedSignature = base64Encode(new Uint8Array(signatureBytes));

  // webhook-signature may contain multiple signatures separated by spaces,
  // each prefixed with "v1,"
  const signatures = webhookSignature.split(' ');
  const isValid = signatures.some((sig) => {
    const value = sig.startsWith('v1,') ? sig.slice(3) : sig;
    return timingSafeEqual(value, expectedSignature);
  });

  if (!isValid) {
    throw new Error('Invalid webhook signature');
  }
}

function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ---------------------------------------------------------------------------
// Polar product → plan mapping
// ---------------------------------------------------------------------------

const PRODUCT_TO_PLAN: Record<string, { plan: string; interval: string }> = {
  'POLAR_PRODUCT_ID': { plan: 'pro', interval: 'month' },
  'POLAR_PRODUCT_ID': { plan: 'pro', interval: 'year' },
  'POLAR_PRODUCT_ID': { plan: 'organization', interval: 'month' },
  'POLAR_PRODUCT_ID': { plan: 'organization', interval: 'year' },
  'POLAR_PRODUCT_ID': { plan: 'flex', interval: 'month' },
};

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

interface PolarSubscriptionData {
  id: string;
  status: string;
  customerId: string;
  productId: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  customer: {
    id: string;
    externalId?: string | null;
    email: string;
    metadata?: Record<string, unknown>;
  };
}

interface PolarWebhookEvent {
  type: string;
  data: PolarSubscriptionData;
}

function mapPolarStatus(polarStatus: string): string {
  switch (polarStatus) {
    case 'active':
      return 'active';
    case 'canceled':
      return 'canceled';
    case 'past_due':
      return 'past_due';
    case 'revoked':
      return 'revoked';
    default:
      return 'active';
  }
}

async function handleSubscriptionEvent(
  supabase: ReturnType<typeof createClient>,
  event: PolarWebhookEvent,
): Promise<void> {
  const sub = event.data;
  const productMapping = PRODUCT_TO_PLAN[sub.productId];

  if (!productMapping) {
    console.warn(`Unknown product ID: ${sub.productId}`);
    return;
  }

  // The externalId on the Polar customer is the Supabase user ID
  const userId = sub.customer.externalId ?? null;

  if (!userId) {
    console.warn(`No externalId on Polar customer ${sub.customerId}, skipping`);
    return;
  }

  const status = mapPolarStatus(sub.status);

  const row = {
    user_id: userId,
    organization_id: null,
    polar_subscription_id: sub.id,
    polar_customer_id: sub.customerId,
    polar_product_id: sub.productId,
    plan: productMapping.plan,
    billing_interval: productMapping.interval,
    status,
    current_period_end: sub.currentPeriodEnd,
    cancel_at_period_end: sub.cancelAtPeriodEnd ?? false,
    updated_at: new Date().toISOString(),
  };

  // Upsert by polar_subscription_id
  const { error } = await supabase
    .from('subscriptions')
    .upsert(row, { onConflict: 'polar_subscription_id' });

  if (error) {
    console.error('Failed to upsert subscription:', error);
    throw new Error(`Database error: ${error.message}`);
  }

  console.log(
    `Subscription ${sub.id} → ${status} (${productMapping.plan}/${productMapping.interval})`,
  );
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = Deno.env.get('POLAR_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('POLAR_WEBHOOK_SECRET not configured');
    return new Response('Server configuration error', { status: 500 });
  }

  const body = await req.text();

  // Verify signature
  try {
    await verifyWebhookSignature(body, req.headers, webhookSecret);
  } catch (err) {
    console.error('Webhook verification failed:', (err as Error).message);
    return new Response('Invalid signature', { status: 403 });
  }

  // Parse event
  let event: PolarWebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Create Supabase client with service role key (bypasses RLS)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Handle subscription events
  const subscriptionEvents = [
    'subscription.created',
    'subscription.updated',
    'subscription.active',
    'subscription.canceled',
    'subscription.uncanceled',
    'subscription.revoked',
    'subscription.past_due',
  ];

  if (subscriptionEvents.includes(event.type)) {
    try {
      await handleSubscriptionEvent(supabase, event);
    } catch (err) {
      console.error(`Error handling ${event.type}:`, (err as Error).message);
      return new Response('Processing error', { status: 500 });
    }
  } else {
    console.log(`Ignoring unhandled event type: ${event.type}`);
  }

  return new Response('OK', { status: 200 });
});
