import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

function createStorageMock(): Storage {
  const storage = Object.create(null) as Record<string, string>;

  Object.defineProperties(storage, {
    length: {
      get: () => Object.keys(storage).length,
      enumerable: false,
    },
    clear: {
      value: () => {
        for (const key of Object.keys(storage)) {
          delete storage[key];
        }
      },
      enumerable: false,
    },
    getItem: {
      value: (key: string) =>
        Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null,
      enumerable: false,
    },
    key: {
      value: (index: number) => Object.keys(storage)[index] ?? null,
      enumerable: false,
    },
    removeItem: {
      value: (key: string) => {
        delete storage[key];
      },
      enumerable: false,
    },
    setItem: {
      value: (key: string, value: string) => {
        storage[key] = String(value);
      },
      enumerable: false,
    },
  });

  return storage as Storage;
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
