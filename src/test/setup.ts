import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

function createStorageMock(): Storage {
  const data = Object.create(null) as Record<string, string>;

  const storage = {
    get length(): number {
      return Object.keys(data).length;
    },
    clear(): void {
      for (const key of Object.keys(data)) {
        delete data[key];
      }
    },
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    key(index: number): string | null {
      const keys = Object.keys(data);
      return keys[index] ?? null;
    },
    removeItem(key: string): void {
      delete data[key];
    },
    setItem(key: string, value: string): void {
      data[key] = String(value);
    },
  } as Storage;

  return storage;
}

function installStorageMock(key: 'localStorage' | 'sessionStorage', storage: Storage): void {
  Object.defineProperty(globalThis, key, {
    value: storage,
    configurable: true,
    writable: true,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, key, {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

installStorageMock('localStorage', localStorageMock);
installStorageMock('sessionStorage', sessionStorageMock);

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = 'test-version';
(globalThis as { __GIT_BRANCH__?: string }).__GIT_BRANCH__ = 'test-branch';

beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
});

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
