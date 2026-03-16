/**
 * Polar Usage Report Edge Function
 *
 * Reports string counts for Flex plan subscribers to Polar's event
 * ingestion API. Designed to be called on a daily schedule (cron).
 *
 * For each active Flex subscriber, counts their total strings across
 * all projects and ingests a `strings_stored` event with the count
 * as metadata. Polar's meter (Max aggregation on `strings_count`)
 * uses the peak value per billing period for invoicing.
 *
 * Uses the Supabase service role key to bypass RLS for reads.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const POLAR_API_URL = 'https://api.polar.sh/v1';

interface FlexSubscriber {
  user_id: string;
  polar_customer_id: string | null;
}

Deno.serve(async (req) => {
  // Allow both POST (cron) and GET (manual trigger)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  const polarAccessToken = Deno.env.get('POLAR_ACCESS_TOKEN');
  if (!polarAccessToken) {
    console.error('POLAR_ACCESS_TOKEN not configured');
    return jsonResponse({ error: 'Server configuration error' }, 500);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Find all active Flex subscribers
  const { data: flexSubs, error: subsError } = await supabase
    .from('subscriptions')
    .select('user_id, polar_customer_id')
    .eq('plan', 'flex')
    .eq('status', 'active')
    .not('user_id', 'is', null);

  if (subsError) {
    console.error('Failed to fetch flex subscribers:', subsError);
    return jsonResponse({ error: 'Database error' }, 500);
  }

  if (!flexSubs || flexSubs.length === 0) {
    console.log('No active Flex subscribers found');
    return jsonResponse({ message: 'No flex subscribers', reported: 0 });
  }

  // 2. Count total strings per subscriber
  const userIds = (flexSubs as FlexSubscriber[]).map((s) => s.user_id);

  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('owner_id, stats_total')
    .in('owner_id', userIds);

  if (projError) {
    console.error('Failed to fetch project stats:', projError);
    return jsonResponse({ error: 'Database error' }, 500);
  }

  // Aggregate strings per user
  const stringsByUser = new Map<string, number>();
  for (const p of projects ?? []) {
    const current = stringsByUser.get(p.owner_id) ?? 0;
    stringsByUser.set(p.owner_id, current + (p.stats_total ?? 0));
  }

  // 3. Build Polar events
  const events = (flexSubs as FlexSubscriber[])
    .filter((s) => s.user_id)
    .map((s) => ({
      name: 'strings_stored',
      externalCustomerId: s.user_id,
      metadata: {
        strings_count: stringsByUser.get(s.user_id) ?? 0,
      },
    }));

  if (events.length === 0) {
    console.log('No events to report');
    return jsonResponse({ message: 'No events', reported: 0 });
  }

  // 4. Ingest events to Polar
  const ingestResponse = await fetch(`${POLAR_API_URL}/events/ingest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${polarAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ events }),
  });

  if (!ingestResponse.ok) {
    const errorText = await ingestResponse.text();
    console.error('Polar event ingestion failed:', ingestResponse.status, errorText);
    return jsonResponse({ error: 'Polar ingestion failed' }, 502);
  }

  const result = await ingestResponse.json();
  console.log(
    `Usage report: ${result.inserted} events ingested, ${result.duplicates ?? 0} duplicates`,
  );

  return jsonResponse({
    message: 'Usage reported',
    reported: result.inserted,
    duplicates: result.duplicates ?? 0,
  });
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
