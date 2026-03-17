/**
 * notify-digest — batches string-update notifications.
 *
 * Runs on a schedule (hourly via pg_cron).
 * Reads notification_string_update_log, groups by project/language,
 * creates strings_updated notifications for eligible members,
 * queues emails, and truncates processed rows.
 *
 * Respects per-user and per-project digest_frequency preferences.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) {
    return new Response(JSON.stringify({ error: 'Service key not configured' }), { status: 500 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Read staging table
    const { data: logs, error: logErr } = await supabase.from('notification_string_update_log')
      .select(`
        project_id,
        language_id,
        updated_by,
        update_count,
        first_at,
        last_at
      `);

    if (logErr) throw logErr;
    if (!logs || logs.length === 0) {
      return new Response(JSON.stringify({ ok: true, notifications: 0 }));
    }

    let notificationCount = 0;

    for (const log of logs) {
      // 2. Get project and language info
      const { data: project } = await supabase
        .from('projects')
        .select('id, name, owner_id')
        .eq('id', log.project_id)
        .single();

      const { data: language } = await supabase
        .from('project_languages')
        .select('id, locale')
        .eq('id', log.language_id)
        .single();

      if (!project || !language) continue;

      // 3. Get updater name
      let updatedByName: string | null = null;
      if (log.updated_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', log.updated_by)
          .single();
        updatedByName = profile?.full_name ?? profile?.email ?? null;
      }

      // 4. Get all project members + owner
      const { data: members } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', log.project_id);

      const recipientIds = new Set<string>();
      if (project.owner_id) recipientIds.add(project.owner_id);
      if (members) {
        for (const m of members) recipientIds.add(m.user_id);
      }

      // Remove the person who made the update
      if (log.updated_by) recipientIds.delete(log.updated_by);

      // 5. For each recipient, check preferences and create notification
      for (const recipientId of recipientIds) {
        // Check global digest frequency
        const { data: globalPrefs } = await supabase
          .from('notification_preferences')
          .select('preferences, digest_frequency')
          .eq('user_id', recipientId)
          .maybeSingle();

        // Check project-level override
        const { data: projectPrefs } = await supabase
          .from('project_notification_preferences')
          .select('preferences, digest_frequency')
          .eq('user_id', recipientId)
          .eq('project_id', log.project_id)
          .maybeSingle();

        // Resolve digest frequency: project ?? global ?? 'daily'
        const digestFreq =
          projectPrefs?.digest_frequency ?? globalPrefs?.digest_frequency ?? 'daily';

        // Skip if digest is off
        if (digestFreq === 'off') continue;

        // Check if enough time has passed for this frequency
        const now = new Date();
        const lastAt = new Date(log.last_at);
        const ageMs = now.getTime() - lastAt.getTime();
        const ageHours = ageMs / (1000 * 60 * 60);

        // Only process if the log is old enough for the frequency
        // (hourly: immediately on hourly run, daily: 1+ hours old, weekly: 24+ hours old)
        if (digestFreq === 'daily' && ageHours < 1) continue;
        if (digestFreq === 'weekly' && ageHours < 24) continue;

        // Resolve in_app / email preferences
        const globalTypePref = globalPrefs?.preferences?.strings_updated;
        const projectTypePref = projectPrefs?.preferences?.strings_updated;
        const inApp = projectTypePref?.in_app ?? globalTypePref?.in_app ?? true;
        const email = projectTypePref?.email ?? globalTypePref?.email ?? true;

        if (!inApp && !email) continue;

        const notifData = {
          project_id: project.id,
          project_name: project.name,
          language_id: language.id,
          locale: language.locale,
          update_count: log.update_count,
          updated_by_name: updatedByName,
        };

        // Create notification
        if (inApp) {
          const { data: notif } = await supabase
            .from('notifications')
            .insert({
              recipient_id: recipientId,
              type: 'strings_updated',
              data: notifData,
            })
            .select('id')
            .single();

          if (notif && email) {
            // Queue email
            await supabase.from('pending_notification_emails').insert({
              notification_id: notif.id,
              recipient_id: recipientId,
            });
          }
          notificationCount++;
        } else if (email) {
          // Email only — still need a notification row for the email reference
          const { data: notif } = await supabase
            .from('notifications')
            .insert({
              recipient_id: recipientId,
              type: 'strings_updated',
              data: notifData,
            })
            .select('id')
            .single();

          if (notif) {
            await supabase.from('pending_notification_emails').insert({
              notification_id: notif.id,
              recipient_id: recipientId,
            });
          }
          notificationCount++;
        }
      }
    }

    // 6. Clear processed staging rows
    const { error: deleteErr } = await supabase
      .from('notification_string_update_log')
      .delete()
      .in(
        'project_id',
        logs.map((l) => l.project_id),
      );

    if (deleteErr) {
      console.error('Failed to clear staging table:', deleteErr);
    }

    return new Response(JSON.stringify({ ok: true, notifications: notificationCount }));
  } catch (err) {
    console.error('notify-digest error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500 },
    );
  }
});
