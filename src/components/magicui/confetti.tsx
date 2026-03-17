import { useEffect } from 'react';
import { fireConfetti } from './confetti-fire';

export function Confetti() {
  useEffect(() => {
    fireConfetti();
  }, []);

  return null;
}
