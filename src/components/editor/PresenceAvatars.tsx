/**
 * PresenceAvatars — shows online collaborators in the editor header.
 *
 * Renders a row of colored avatar circles for each user connected
 * to the same project-language Realtime channel.
 */

import { Avatar, Group, Tooltip } from '@mantine/core';
import { useCollaborationStore } from '@/stores/collaboration-store';

export function PresenceAvatars() {
  const onlineUsers = useCollaborationStore((s) => s.onlineUsers);
  const isConnected = useCollaborationStore((s) => s.channelConnected);

  if (!isConnected || onlineUsers.size === 0) return null;

  const users = Array.from(onlineUsers.values());

  return (
    <Group gap={4}>
      {users.map((user) => (
        <Tooltip key={user.userId} label={user.displayName} position="bottom">
          <Avatar
            src={user.avatarUrl}
            alt={user.displayName}
            size={28}
            radius="xl"
            style={{
              border: `2px solid ${user.color}`,
              boxShadow: `0 0 0 1px var(--mantine-color-body)`,
            }}
          >
            {user.displayName.charAt(0).toUpperCase()}
          </Avatar>
        </Tooltip>
      ))}
    </Group>
  );
}
