import { useCallback, useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';

interface ParticlesProps {
  className?: string;
  quantity?: number;
  staticity?: number;
  ease?: number;
  size?: number;
  color?: string;
  vx?: number;
  vy?: number;
  refresh?: boolean;
}

interface Circle {
  x: number;
  y: number;
  translateX: number;
  translateY: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [255, 255, 255];
}

export function Particles({
  className,
  quantity = 100,
  staticity = 50,
  ease = 50,
  size = 0.4,
  color = '#ffffff',
  vx = 0,
  vy = 0,
  refresh = false,
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const circlesRef = useRef<Circle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const canvasSizeRef = useRef({ w: 0, h: 0 });
  const animFrameRef = useRef(0);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

  const rgb = hexToRgb(color);

  const createCircle = useCallback((): Circle => {
    const x = Math.floor(Math.random() * canvasSizeRef.current.w);
    const y = Math.floor(Math.random() * canvasSizeRef.current.h);
    const pSize = Math.floor(Math.random() * 2) + size;
    const alpha = 0;
    const targetAlpha = parseFloat((Math.random() * 0.6 + 0.1).toFixed(1));
    const dx = (Math.random() - 0.5) * 0.1;
    const dy = (Math.random() - 0.5) * 0.1;
    const magnetism = 0.1 + Math.random() * 4;
    return {
      x,
      y,
      translateX: 0,
      translateY: 0,
      size: pSize,
      alpha,
      targetAlpha,
      dx,
      dy,
      magnetism,
    };
  }, [size]);

  const drawCircle = useCallback(
    (circle: Circle) => {
      const ctx = contextRef.current;
      if (!ctx) return;
      ctx.translate(circle.translateX, circle.translateY);
      ctx.beginPath();
      ctx.arc(circle.x, circle.y, circle.size, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${rgb.join(',')}, ${circle.alpha})`;
      ctx.fill();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    [dpr, rgb],
  );

  const initCanvas = useCallback(() => {
    const container = canvasContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    circlesRef.current = [];
    canvasSizeRef.current.w = container.offsetWidth;
    canvasSizeRef.current.h = container.offsetHeight;
    canvas.width = canvasSizeRef.current.w * dpr;
    canvas.height = canvasSizeRef.current.h * dpr;
    canvas.style.width = `${canvasSizeRef.current.w}px`;
    canvas.style.height = `${canvasSizeRef.current.h}px`;
    contextRef.current = canvas.getContext('2d');
    if (contextRef.current) {
      contextRef.current.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, [dpr]);

  const drawParticles = useCallback(() => {
    const ctx = contextRef.current;
    if (ctx) ctx.clearRect(0, 0, canvasSizeRef.current.w, canvasSizeRef.current.h);
    circlesRef.current = [];
    for (let i = 0; i < quantity; i++) {
      const circle = createCircle();
      circlesRef.current.push(circle);
      drawCircle(circle);
    }
  }, [quantity, createCircle, drawCircle]);

  useEffect(() => {
    initCanvas();
    drawParticles();

    function remap(value: number, start1: number, end1: number, start2: number, end2: number) {
      const r = ((value - start1) * (end2 - start2)) / (end1 - start1) + start2;
      return r > 0 ? r : 0;
    }

    function tick() {
      const ctx = contextRef.current;
      if (ctx) ctx.clearRect(0, 0, canvasSizeRef.current.w, canvasSizeRef.current.h);

      const circles = circlesRef.current;
      for (let i = circles.length - 1; i >= 0; i--) {
        const c = circles[i];
        const edges = [
          c.x + c.translateX - c.size,
          canvasSizeRef.current.w - c.x - c.translateX - c.size,
          c.y + c.translateY - c.size,
          canvasSizeRef.current.h - c.y - c.translateY - c.size,
        ];
        const closest = Math.min(...edges);
        const remapped = parseFloat(remap(closest, 0, 20, 0, 1).toFixed(2));

        if (remapped > 1) {
          c.alpha += 0.02;
          if (c.alpha > c.targetAlpha) c.alpha = c.targetAlpha;
        } else {
          c.alpha = c.targetAlpha * remapped;
        }

        c.x += c.dx + vx;
        c.y += c.dy + vy;
        c.translateX += (mouseRef.current.x / (staticity / c.magnetism) - c.translateX) / ease;
        c.translateY += (mouseRef.current.y / (staticity / c.magnetism) - c.translateY) / ease;

        const out =
          c.x < -c.size ||
          c.x > canvasSizeRef.current.w + c.size ||
          c.y < -c.size ||
          c.y > canvasSizeRef.current.h + c.size;

        if (out) {
          circles.splice(i, 1);
          const newC = createCircle();
          circles.push(newC);
          drawCircle(newC);
        } else {
          drawCircle(c);
        }
      }

      animFrameRef.current = window.requestAnimationFrame(tick);
    }

    animFrameRef.current = window.requestAnimationFrame(tick);

    const handleResize = () => {
      initCanvas();
      drawParticles();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [initCanvas, drawParticles, createCircle, drawCircle, vx, vy, staticity, ease]);

  useEffect(() => {
    initCanvas();
    drawParticles();
  }, [refresh, initCanvas, drawParticles]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const container = canvasContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { w, h } = canvasSizeRef.current;
    const x = e.clientX - rect.left - w / 2;
    const y = e.clientY - rect.top - h / 2;
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (inside) {
      mouseRef.current.x = x;
      mouseRef.current.y = y;
    }
  }, []);

  return (
    <div
      className={cn('pointer-events-none', className)}
      ref={canvasContainerRef}
      aria-hidden="true"
      onMouseMove={onMouseMove}
    >
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}
