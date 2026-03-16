/**
 * ProjectGrid — responsive grid of project cards with staggered entry.
 */

import { SimpleGrid } from '@mantine/core';
import { motion } from 'motion/react';
import { staggerContainerVariants, contentVariants } from '@/lib/motion';
import { ProjectCard } from './ProjectCard';
import type { ProjectWithLanguages } from '@/lib/projects/types';

const MotionDiv = motion.div;

interface ProjectGridProps {
  projects: ProjectWithLanguages[];
  onDelete?: (id: string) => void;
  /** Only show delete for projects the current user owns. */
  ownerId?: string;
}

export function ProjectGrid({ projects, onDelete, ownerId }: ProjectGridProps) {
  return (
    <MotionDiv variants={staggerContainerVariants} initial="hidden" animate="visible">
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, xl: 4 }} spacing="md">
        {projects.map((project) => (
          <MotionDiv key={project.id} variants={contentVariants}>
            <ProjectCard
              project={project}
              onDelete={
                onDelete && (!ownerId || project.owner_id === ownerId) ? onDelete : undefined
              }
            />
          </MotionDiv>
        ))}
      </SimpleGrid>
    </MotionDiv>
  );
}
