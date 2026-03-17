/**
 * notify-email — drains the pending_notification_emails queue.
 *
 * Designed to run on a schedule (every 2 minutes via pg_cron or external cron).
 * Reads queued emails, builds templates, sends via Resend, deletes processed rows.
 *
 * Auth: requires service role key (no user auth).
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildEmailTemplate } from '../_shared/email-templates.ts';
import { sendEmailBatch, type EmailPayload } from '../_shared/resend.ts';

const BATCH_LIMIT = 50; // Max emails per invocation

Deno.serve(async (req: Request) => {
  // Only allow POST (from cron) or GET (for manual trigger)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  // Verify service role auth
  const authHeader = req.headers.get('authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Service key not configured' }), { status: 500 });
  }

  // Allow calls from pg_cron (which passes service key) or with valid auth
  if (authHeader && !authHeader.includes(serviceKey)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Fetch pending emails with notification data and recipient profile
    const { data: pending, error: fetchErr } = await supabase
      .from('pending_notification_emails')
      .select(
        `
        id,
        notification_id,
        recipient_id,
        notifications!inner (type, data),
        profiles:recipient_id (email)
      `,
      )
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (fetchErr) throw fetchErr;
    if (!pending || pending.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }));
    }

    // 2. Build email payloads
    const emails: EmailPayload[] = [];
    const processedIds: string[] = [];

    for (const row of pending) {
      const notification = row.notifications as {
        type: string;
        data: Record<string, unknown>;
      } | null;
      const profile = row.profiles as { email: string } | null;

      if (!notification || !profile?.email) {
        // Skip but still mark as processed to avoid infinite retry
        processedIds.push(row.id);
        continue;
      }

      const template = buildEmailTemplate(notification.type, notification.data);
      if (!template) {
        processedIds.push(row.id);
        continue;
      }

      emails.push({
        to: profile.email,
        subject: template.subject,
        html: template.html,
      });
      processedIds.push(row.id);
    }

    // 3. Send emails in rate-limited batches
    const result = await sendEmailBatch(emails, 10, 1000);

    // 4. Delete processed rows
    if (processedIds.length > 0) {
      const { error: deleteErr } = await supabase
        .from('pending_notification_emails')
        .delete()
        .in('id', processedIds);

      if (deleteErr) {
        console.error('Failed to delete processed emails:', deleteErr);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: processedIds.length,
        sent: result.sent,
        failed: result.failed,
      }),
    );
  } catch (err) {
    console.error('notify-email error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500 },
    );
  }
});
