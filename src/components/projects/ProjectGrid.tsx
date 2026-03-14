/**
 * ProjectGrid — responsive grid of project cards.
 */

import { SimpleGrid } from '@mantine/core';
import { ProjectCard } from './ProjectCard';
import type { ProjectWithLanguages } from '@/lib/projects/types';

interface ProjectGridProps {
  projects: ProjectWithLanguages[];
  onDelete: (id: string) => void;
}

export function ProjectGrid({ projects, onDelete }: ProjectGridProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} onDelete={onDelete} />
      ))}
    </SimpleGrid>
  );
}
