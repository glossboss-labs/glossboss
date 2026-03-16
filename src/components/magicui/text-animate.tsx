import { type ElementType, memo } from 'react';
import { AnimatePresence, motion, type MotionProps, type Variants } from 'motion/react';

import { cn } from '@/lib/utils';

type AnimationType = 'text' | 'word' | 'character' | 'line';
type AnimationVariant =
  | 'fadeIn'
  | 'blurIn'
  | 'blurInUp'
  | 'blurInDown'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'scaleUp'
  | 'scaleDown';

interface TextAnimateProps extends MotionProps {
  children: string;
  className?: string;
  segmentClassName?: string;
  delay?: number;
  duration?: number;
  variants?: Variants;
  as?: ElementType;
  by?: AnimationType;
  startOnView?: boolean;
  once?: boolean;
  animation?: AnimationVariant;
}

const staggerTimings: Record<AnimationType, number> = {
  text: 0.06,
  word: 0.05,
  character: 0.03,
  line: 0.06,
};

const defaultContainerVariants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      delayChildren: 0,
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

const defaultItemAnimationVariants: Record<
  AnimationVariant,
  { container: Variants; item: Variants }
> = {
  fadeIn: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: 20 },
      show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
      exit: { opacity: 0, y: 20, transition: { duration: 0.3 } },
    },
  },
  blurIn: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: 'blur(10px)' },
      show: { opacity: 1, filter: 'blur(0px)', transition: { duration: 0.3 } },
      exit: { opacity: 0, filter: 'blur(10px)', transition: { duration: 0.3 } },
    },
  },
  blurInUp: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: 'blur(10px)', y: 20 },
      show: {
        opacity: 1,
        filter: 'blur(0px)',
        y: 0,
        transition: { y: { duration: 0.3 }, opacity: { duration: 0.4 }, filter: { duration: 0.3 } },
      },
      exit: {
        opacity: 0,
        filter: 'blur(10px)',
        y: 20,
        transition: { y: { duration: 0.3 }, opacity: { duration: 0.4 }, filter: { duration: 0.3 } },
      },
    },
  },
  blurInDown: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: 'blur(10px)', y: -20 },
      show: {
        opacity: 1,
        filter: 'blur(0px)',
        y: 0,
        transition: { y: { duration: 0.3 }, opacity: { duration: 0.4 }, filter: { duration: 0.3 } },
      },
    },
  },
  slideUp: {
    container: defaultContainerVariants,
    item: {
      hidden: { y: 20, opacity: 0 },
      show: { y: 0, opacity: 1, transition: { duration: 0.3 } },
      exit: { y: -20, opacity: 0, transition: { duration: 0.3 } },
    },
  },
  slideDown: {
    container: defaultContainerVariants,
    item: {
      hidden: { y: -20, opacity: 0 },
      show: { y: 0, opacity: 1, transition: { duration: 0.3 } },
      exit: { y: 20, opacity: 0, transition: { duration: 0.3 } },
    },
  },
  slideLeft: {
    container: defaultContainerVariants,
    item: {
      hidden: { x: 20, opacity: 0 },
      show: { x: 0, opacity: 1, transition: { duration: 0.3 } },
      exit: { x: -20, opacity: 0, transition: { duration: 0.3 } },
    },
  },
  slideRight: {
    container: defaultContainerVariants,
    item: {
      hidden: { x: -20, opacity: 0 },
      show: { x: 0, opacity: 1, transition: { duration: 0.3 } },
      exit: { x: 20, opacity: 0, transition: { duration: 0.3 } },
    },
  },
  scaleUp: {
    container: defaultContainerVariants,
    item: {
      hidden: { scale: 0.5, opacity: 0 },
      show: { scale: 1, opacity: 1, transition: { duration: 0.3 } },
      exit: { scale: 0.5, opacity: 0, transition: { duration: 0.3 } },
    },
  },
  scaleDown: {
    container: defaultContainerVariants,
    item: {
      hidden: { scale: 1.5, opacity: 0 },
      show: { scale: 1, opacity: 1, transition: { duration: 0.3 } },
      exit: { scale: 1.5, opacity: 0, transition: { duration: 0.3 } },
    },
  },
};

function TextAnimateInner({
  children,
  className,
  segmentClassName,
  delay = 0,
  duration,
  variants,
  as: Component = 'p',
  by = 'word',
  startOnView = true,
  once = true,
  animation = 'fadeIn',
  ...motionProps
}: TextAnimateProps) {
  const animVariants = defaultItemAnimationVariants[animation];
  const selectedVariants = variants || animVariants.item;

  const containerVariants: Variants = {
    hidden: { opacity: 1 },
    show: {
      opacity: 1,
      transition: {
        delayChildren: delay,
        staggerChildren: duration ?? staggerTimings[by],
      },
    },
    exit: {
      opacity: 0,
      transition: {
        staggerChildren: duration ?? staggerTimings[by],
        staggerDirection: -1,
      },
    },
  };

  let segments: string[];
  switch (by) {
    case 'word':
      segments = children.split(/(\s+)/);
      break;
    case 'character':
      segments = children.split('');
      break;
    case 'line':
      segments = children.split('\n');
      break;
    case 'text':
    default:
      segments = [children];
      break;
  }

  const viewProps = startOnView
    ? { initial: 'hidden' as const, whileInView: 'show' as const, viewport: { once } }
    : { initial: 'hidden' as const, animate: 'show' as const };

  const inner = segments.map((segment, i) => (
    <motion.span
      key={`${by}-${i}`}
      variants={selectedVariants}
      className={cn('inline-block', segmentClassName)}
    >
      {segment === '' ? '\u00A0' : segment}
    </motion.span>
  ));

  return (
    <AnimatePresence mode="wait">
      {Component === 'h1' ? (
        <motion.h1
          variants={containerVariants}
          {...viewProps}
          className={cn('whitespace-pre-wrap', className)}
          {...motionProps}
        >
          {inner}
        </motion.h1>
      ) : Component === 'h2' ? (
        <motion.h2
          variants={containerVariants}
          {...viewProps}
          className={cn('whitespace-pre-wrap', className)}
          {...motionProps}
        >
          {inner}
        </motion.h2>
      ) : Component === 'span' ? (
        <motion.span
          variants={containerVariants}
          {...viewProps}
          className={cn('whitespace-pre-wrap', className)}
          {...motionProps}
        >
          {inner}
        </motion.span>
      ) : (
        <motion.p
          variants={containerVariants}
          {...viewProps}
          className={cn('whitespace-pre-wrap', className)}
          {...motionProps}
        >
          {inner}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export const TextAnimate = memo(TextAnimateInner);
TextAnimate.displayName = 'TextAnimate';
