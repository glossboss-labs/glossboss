import { useRef, useEffect, useMemo } from 'react';

// Lower stiffness = more floaty/trailing, higher damping = less oscillation
const SPRING_STIFFNESS = 0.06;
const SPRING_DAMPING = 0.82;
const TILT_SMOOTHING = 0.08; // how fast tilt catches up (lower = smoother)
const TILT_SENSITIVITY = 0.6; // degrees per px/frame of velocity
const MAX_TILT = 6; // max degrees

/**
 * Hook that creates a "lifted card" drag ghost from a source DOM element.
 * Builds a clean div matching the source dimensions and text, then applies
 * spring-physics positioning with velocity-based tilt.
 */
export function useDragGhost() {
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const targetPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const rafId = useRef(0);
  const isActive = useRef(false);
  const grabOffset = useRef({ x: 0, y: 0 });
  const currentTilt = useRef(0);

  useEffect(() => {
    return () => {
      isActive.current = false;
      cancelAnimationFrame(rafId.current);
      ghostRef.current?.remove();
    };
  }, []);

  return useMemo(
    () => ({
      /**
       * Lift an element out of the UI as a ghost card.
       * @param sourceEl - The DOM element to base the ghost on
       * @param pointerX - clientX of the pointer event
       * @param pointerY - clientY of the pointer event
       * @param label - Optional text override (defaults to sourceEl.textContent)
       */
      show(sourceEl: HTMLElement, pointerX: number, pointerY: number, label?: string) {
        isActive.current = false;
        cancelAnimationFrame(rafId.current);
        rafId.current = 0;

        if (ghostRef.current) {
          ghostRef.current.remove();
          ghostRef.current = null;
        }

        const rect = sourceEl.getBoundingClientRect();
        const computed = getComputedStyle(sourceEl);

        // Calculate grab offset (pointer position relative to element)
        grabOffset.current = { x: pointerX - rect.left, y: pointerY - rect.top };

        // Build a clean div ghost instead of cloning (avoids table/menu element quirks)
        const ghost = document.createElement('div');
        ghost.textContent = label ?? sourceEl.textContent?.trim() ?? '';

        Object.assign(ghost.style, {
          position: 'fixed',
          left: '0px',
          top: '0px',
          width: `${rect.width}px`,
          boxSizing: 'border-box',
          padding: `${computed.paddingTop} ${computed.paddingRight} ${computed.paddingBottom} ${computed.paddingLeft}`,
          display: 'flex',
          alignItems: 'center',
          fontSize: computed.fontSize,
          fontWeight: '600',
          fontFamily: computed.fontFamily,
          lineHeight: computed.lineHeight,
          color: 'var(--mantine-color-text)',
          backgroundColor: 'var(--mantine-color-body)',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          pointerEvents: 'none',
          zIndex: '10000',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          willChange: 'transform',
          opacity: '0',
          transition: 'opacity 180ms ease-out, box-shadow 300ms ease-out',
        });

        document.body.appendChild(ghost);
        ghostRef.current = ghost;

        // Initial position matches the source element
        const startX = rect.left;
        const startY = rect.top;
        targetPos.current = { x: startX, y: startY };
        currentPos.current = { x: startX, y: startY };
        velocity.current = { x: 0, y: 0 };
        currentTilt.current = 0;

        ghost.style.transform = `translate3d(${startX}px, ${startY}px, 0) scale(1) rotate(0deg)`;

        // Animate in
        requestAnimationFrame(() => {
          if (ghost.parentNode) {
            ghost.style.opacity = '1';
            ghost.style.boxShadow = '0 20px 48px rgba(0,0,0,0.18), 0 8px 16px rgba(0,0,0,0.10)';
          }
        });

        isActive.current = true;
        const tick = () => {
          if (!isActive.current) return;

          const dx = targetPos.current.x - currentPos.current.x;
          const dy = targetPos.current.y - currentPos.current.y;

          velocity.current.x = (velocity.current.x + dx * SPRING_STIFFNESS) * SPRING_DAMPING;
          velocity.current.y = (velocity.current.y + dy * SPRING_STIFFNESS) * SPRING_DAMPING;

          currentPos.current.x += velocity.current.x;
          currentPos.current.y += velocity.current.y;

          // Smoothly interpolate tilt toward velocity-based target
          const targetTilt = Math.max(
            -MAX_TILT,
            Math.min(MAX_TILT, velocity.current.x * TILT_SENSITIVITY),
          );
          currentTilt.current += (targetTilt - currentTilt.current) * TILT_SMOOTHING;

          if (ghostRef.current) {
            ghostRef.current.style.transform = `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0) scale(1.03) rotate(${currentTilt.current.toFixed(2)}deg)`;
          }

          rafId.current = requestAnimationFrame(tick);
        };
        rafId.current = requestAnimationFrame(tick);
      },

      move(pointerX: number, pointerY: number) {
        targetPos.current = {
          x: pointerX - grabOffset.current.x,
          y: pointerY - grabOffset.current.y,
        };
      },

      hide() {
        isActive.current = false;
        cancelAnimationFrame(rafId.current);

        const el = ghostRef.current;
        if (el) {
          el.style.transition =
            'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-in, box-shadow 220ms ease-in';
          el.style.transform = `translate3d(${targetPos.current.x}px, ${targetPos.current.y}px, 0) scale(0.97) rotate(0deg)`;
          el.style.opacity = '0';
          el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
          setTimeout(() => el.remove(), 280);
          ghostRef.current = null;
        }
      },
    }),
    [],
  );
}
