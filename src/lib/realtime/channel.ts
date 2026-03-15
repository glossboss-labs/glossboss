/**
 * Supabase Realtime channel factory.
 *
 * Creates a channel scoped to a project + language combination
 * with both Presence and Broadcast capabilities.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface ChannelConfig {
  projectId: string;
  languageId: string;
  userId: string;
}

function getChannelName(projectId: string, languageId: string): string {
  return `project:${projectId}:lang:${languageId}`;
}

export function createProjectChannel(
  client: SupabaseClient,
  config: ChannelConfig,
): RealtimeChannel {
  const channelName = getChannelName(config.projectId, config.languageId);

  return client.channel(channelName, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: config.userId },
    },
  });
}
