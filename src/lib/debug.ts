const isDev = import.meta.env.DEV;

export function debugLog(...args: unknown[]): void {
  if (isDev) {
    console.log(...args);
  }
}

export function debugInfo(...args: unknown[]): void {
  if (isDev) {
    console.info(...args);
  }
}

export function debugWarn(...args: unknown[]): void {
  if (isDev) {
    console.warn(...args);
  }
}

export function debugError(...args: unknown[]): void {
  if (isDev) {
    console.error(...args);
  }
}
