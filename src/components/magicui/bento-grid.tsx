import { type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface BentoGridProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
  className?: string;
}

interface BentoCardProps extends ComponentPropsWithoutRef<'div'> {
  name: string;
  className: string;
  background?: ReactNode;
  Icon: React.ElementType;
  description: string;
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div className={cn('grid w-full auto-rows-[22rem] grid-cols-3 gap-3', className)} {...props}>
      {children}
    </div>
  );
};

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  ...props
}: BentoCardProps) => (
  <div
    key={name}
    className={cn(
      'group relative col-span-3 flex flex-col justify-end overflow-hidden rounded-lg border border-border-subtle bg-surface-1 p-5',
      className,
    )}
    {...props}
  >
    <div className="absolute inset-0">{background}</div>
    <div className="relative z-10 flex flex-col gap-1.5">
      <Icon className="mb-1 h-8 w-8 text-text-tertiary" strokeWidth={1.5} />
      <h3 className="text-sm font-semibold text-text-primary">{name}</h3>
      <p className="text-sm leading-relaxed text-text-secondary">{description}</p>
    </div>
  </div>
);

export { BentoCard, BentoGrid };
