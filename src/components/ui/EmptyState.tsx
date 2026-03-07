/**
 * Empty State Component
 * 
 * Animated placeholder for empty content areas.
 */

import { Stack, Text, Title, ThemeIcon } from '@mantine/core';
import { motion } from 'motion/react';
import { type LucideIcon } from 'lucide-react';
import { fadeScaleVariants, gentleSpring } from '@/lib/motion';

const MotionStack = motion.create(Stack);

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  iconColor?: string;
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  iconColor = 'gray',
}: EmptyStateProps) {
  return (
    <MotionStack
      align="center"
      gap="md"
      py="xl"
      variants={fadeScaleVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <ThemeIcon size={64} radius="xl" variant="light" color={iconColor}>
        <Icon size={32} />
      </ThemeIcon>
      
      <Stack align="center" gap={4}>
        <Title order={4} c="dimmed">{title}</Title>
        {description && (
          <Text size="sm" c="dimmed" ta="center" maw={300}>
            {description}
          </Text>
        )}
      </Stack>
      
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...gentleSpring, delay: 0.2 }}
        >
          {action}
        </motion.div>
      )}
    </MotionStack>
  );
}
