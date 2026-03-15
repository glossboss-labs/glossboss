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
}

export function ProjectGrid({ projects, onDelete }: ProjectGridProps) {
  return (
    <MotionDiv variants={staggerContainerVariants} initial="hidden" animate="visible">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {projects.map((project) => (
          <MotionDiv key={project.id} variants={contentVariants}>
            <ProjectCard project={project} onDelete={onDelete} />
          </MotionDiv>
        ))}
      </SimpleGrid>
    </MotionDiv>
  );
}
