import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import { LocalStorageAdapter, setStorageAdapter } from '@/lib/cloud';

/** Auto-mock posthog-js so its side effects never run in tests */
vi.mock('posthog-js', () => ({
  default: { init: vi.fn(), capture: vi.fn() },
}));

/** Auto-mock analytics wrapper so no tracking runs in tests */
vi.mock('@/lib/analytics', () => ({
  initPostHog: vi.fn(),
  trackPageView: vi.fn(),
  trackEvent: vi.fn(),
}));

function createStorageMock(): Storage {
  const data = new Map<string, string>();
  const storage = {} as Storage;

  Object.defineProperties(storage, {
    length: {
      configurable: true,
      enumerable: false,
      get(): number {
        return data.size;
      },
    },
    clear: {
      configurable: true,
      enumerable: false,
      writable: true,
      value(): void {
        data.clear();
      },
    },
    getItem: {
      configurable: true,
      enumerable: false,
      writable: true,
      value(key: string): string | null {
        return data.get(String(key)) ?? null;
      },
    },
    key: {
      configurable: true,
      enumerable: false,
      writable: true,
      value(index: number): string | null {
        return Array.from(data.keys())[index] ?? null;
      },
    },
    removeItem: {
      configurable: true,
      enumerable: false,
      writable: true,
      value(key: string): void {
        data.delete(String(key));
      },
    },
    setItem: {
      configurable: true,
      enumerable: false,
      writable: true,
      value(key: string, value: string): void {
        data.set(String(key), String(value));
      },
    },
  });

  return new Proxy(storage, {
    deleteProperty(target, property): boolean {
      if (typeof property === 'string') {
        data.delete(property);
        return true;
      }

      return Reflect.deleteProperty(target, property);
    },
    get(target, property, receiver) {
      if (typeof property === 'string' && !Reflect.has(target, property)) {
        return data.get(property);
      }

      return Reflect.get(target, property, receiver);
    },
    getOwnPropertyDescriptor(target, property) {
      if (typeof property === 'string' && data.has(property)) {
        return {
          configurable: true,
          enumerable: true,
          writable: true,
          value: data.get(property),
        };
      }

      return Reflect.getOwnPropertyDescriptor(target, property);
    },
    has(target, property): boolean {
      if (typeof property === 'string' && data.has(property)) {
        return true;
      }

      return Reflect.has(target, property);
    },
    ownKeys(): string[] {
      return Array.from(data.keys());
    },
    set(target, property, value, receiver): boolean {
      if (typeof property === 'string' && !Reflect.has(target, property)) {
        data.set(property, String(value));
        return true;
      }

      return Reflect.set(target, property, value, receiver);
    },
  });
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

/** Initialize storage adapter before any store modules are evaluated */
setStorageAdapter(new LocalStorageAdapter());

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

if (!window.IntersectionObserver) {
  window.IntersectionObserver = class IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [0];

    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
}
