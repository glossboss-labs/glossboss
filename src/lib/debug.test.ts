import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to test that debug functions call console methods only when
// import.meta.env.DEV is true. Since this is evaluated at build time in Vite,
// we assert behavior based on the actual value instead of trying to stub DEV.

describe('debug utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls console.log when import.meta.env.DEV is true', async () => {
    const { debugLog } = await import('./debug');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('hello', 42);

    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith('hello', 42);
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('calls console.info when import.meta.env.DEV is true', async () => {
    const { debugInfo } = await import('./debug');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    debugInfo('info msg');

    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith('info msg');
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('calls console.warn when import.meta.env.DEV is true', async () => {
    const { debugWarn } = await import('./debug');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    debugWarn('warn msg');

    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith('warn msg');
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('calls console.error when import.meta.env.DEV is true', async () => {
    const { debugError } = await import('./debug');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugError('err msg');

    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith('err msg');
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('respects import.meta.env.DEV for console.log', async () => {
    const { debugLog } = await import('./debug');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    debugLog('hello');

    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith('hello');
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('respects import.meta.env.DEV for console.warn', async () => {
    const { debugWarn } = await import('./debug');
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    debugWarn('warning');

    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith('warning');
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('respects import.meta.env.DEV for console.error', async () => {
    const { debugError } = await import('./debug');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugError('error');

    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith('error');
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('respects import.meta.env.DEV for console.info', async () => {
    const { debugInfo } = await import('./debug');
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    debugInfo('info');

    if (import.meta.env.DEV) {
      expect(spy).toHaveBeenCalledWith('info');
    } else {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
