import confetti from 'canvas-confetti';

/**
 * Fire a big celebratory confetti burst from both sides of the screen.
 */
export function fireConfetti() {
  const duration = 1500;
  const end = Date.now() + duration;

  const colors = ['#ff577f', '#ff884b', '#ffd384', '#fff9b0', '#3ec1d3', '#a855f7', '#22d3ee'];

  function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.6 },
      colors,
      zIndex: 9999,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.6 },
      colors,
      zIndex: 9999,
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }

  // Big initial burst from center
  confetti({
    particleCount: 120,
    spread: 100,
    origin: { y: 0.6 },
    colors,
    zIndex: 9999,
  });

  // Sustained side cannons
  frame();
}
