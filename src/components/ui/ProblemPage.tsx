import { type ReactNode } from 'react';
import { Link } from 'react-router';
import { Container, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { motion } from 'motion/react';
import { contentVariants } from '@/lib/motion';
import { GlossBossLogo } from './GlossBossLogo';

interface ProblemPageDetail {
  label: string;
  value: string;
}

interface ProblemPageProps {
  code?: string;
  title: string;
  message: string;
  details?: ProblemPageDetail[];
  actions?: ReactNode;
  footer?: ReactNode;
}

const MotionDiv = motion.div;

export function ProblemPage({ code, title, message, details, actions, footer }: ProblemPageProps) {
  const isNumericCode = code != null && /^\d+$/.test(code);
  const visualTiles = Array.from({ length: 9 }, (_, index) => {
    const isMissing = index === 4;
    const isAccent = index === 7;

    return (
      <div
        key={index}
        className="h-5 w-5 rounded-[6px] border"
        style={
          isMissing
            ? {
                borderColor: 'var(--gb-border-default)',
                borderStyle: 'dashed',
                backgroundColor: 'transparent',
              }
            : isAccent
              ? {
                  borderColor: 'var(--mantine-color-blue-6)',
                  backgroundColor: 'var(--gb-glow-focus)',
                }
              : {
                  borderColor: 'var(--gb-border-subtle)',
                  backgroundColor: 'var(--gb-surface-1)',
                }
        }
      />
    );
  });

  return (
    <div className="min-h-screen bg-surface-0 px-4 py-6 sm:px-6 sm:py-10">
      <Container size="lg" className="flex min-h-[calc(100vh-3rem)] items-center">
        <MotionDiv variants={contentVariants} initial="hidden" animate="visible" className="w-full">
          <Paper withBorder radius="lg" p={0} className="overflow-hidden">
            <div className="grid md:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <div className="px-6 py-6 sm:px-8 sm:py-8">
                <Stack gap="xl">
                  <Group justify="flex-start">
                    <Link to="/" aria-label="GlossBoss" style={{ display: 'inline-flex' }}>
                      <GlossBossLogo size={30} />
                    </Link>
                  </Group>

                  <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                      <div className="grid w-fit grid-cols-3 gap-2">{visualTiles}</div>
                      {code ? (
                        isNumericCode ? (
                          <Text
                            ff="monospace"
                            fw={700}
                            lh={0.9}
                            className="text-[4.5rem] tracking-[-0.06em] text-text-primary sm:text-[6.5rem]"
                          >
                            {code}
                          </Text>
                        ) : (
                          <div className="inline-flex w-fit rounded-md border border-border-subtle bg-surface-1 px-4 py-3">
                            <Text ff="monospace" size="sm" c="dimmed">
                              {code}
                            </Text>
                          </div>
                        )
                      ) : null}
                    </div>

                    <Stack gap="sm" maw={560}>
                      <Title order={1}>{title}</Title>
                      <Text c="dimmed" size="md" maw={520}>
                        {message}
                      </Text>
                    </Stack>
                  </div>
                </Stack>
              </div>

              <div className="border-t border-border-subtle bg-surface-1 px-6 py-6 sm:px-8 sm:py-8 md:border-l md:border-t-0">
                <Stack gap="lg" h="100%" justify="space-between">
                  <Stack gap="lg">
                    {details?.length ? (
                      <div className="overflow-hidden rounded-md border border-border-subtle bg-surface-0">
                        {details.map((detail, index) => (
                          <div
                            key={`${detail.label}-${index}`}
                            className={
                              index === 0 ? 'px-4 py-3' : 'border-t border-border-subtle px-4 py-3'
                            }
                          >
                            <Text size="sm" c="dimmed" mb={6}>
                              {detail.label}
                            </Text>
                            <Text size="sm" ff="monospace" style={{ overflowWrap: 'anywhere' }}>
                              {detail.value}
                            </Text>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {actions ? (
                      <div className="flex flex-col gap-3 sm:flex-row md:flex-col">{actions}</div>
                    ) : null}
                  </Stack>

                  {footer ? (
                    <Text size="sm" c="dimmed">
                      {footer}
                    </Text>
                  ) : null}
                </Stack>
              </div>
            </div>
          </Paper>
        </MotionDiv>
      </Container>
    </div>
  );
}
