/**
 * RoleBadge — shared badge for org and project roles.
 */

import { Badge } from '@mantine/core';
import { Crown, Shield, Eye, Languages, Users } from 'lucide-react';

const ROLE_CONFIG: Record<string, { color: string; Icon: React.ComponentType<{ size: number }> }> =
  {
    owner: { color: 'yellow', Icon: Crown },
    admin: { color: 'yellow', Icon: Crown },
    maintainer: { color: 'blue', Icon: Shield },
    reviewer: { color: 'violet', Icon: Eye },
    translator: { color: 'green', Icon: Languages },
    viewer: { color: 'gray', Icon: Eye },
    member: { color: 'gray', Icon: Users },
  };

export function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role] ?? { color: 'gray', Icon: Users };
  return (
    <Badge variant="light" size="sm" color={config.color} leftSection={<config.Icon size={10} />}>
      {role}
    </Badge>
  );
}
