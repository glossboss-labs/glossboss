import '@testing-library/jest-dom/vitest';

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = 'test-version';
(globalThis as { __GIT_BRANCH__?: string }).__GIT_BRANCH__ = 'test-branch';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  const storage = {
    get length() {
      return map.size;
    },
    clear() {
      for (const key of map.keys()) {
        delete (storage as Record<string, unknown>)[key];
      }
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
      delete (storage as Record<string, unknown>)[key];
    },
    setItem(key: string, value: string) {
      const stringValue = String(value);
      map.set(key, stringValue);
      Object.defineProperty(storage, key, {
        configurable: true,
        enumerable: true,
        get() {
          return map.get(key);
        },
      });
    },
  };

  return storage as Storage;
}

function ensureStorage(name: 'localStorage' | 'sessionStorage') {
  Object.defineProperty(window, name, {
    configurable: true,
    value: createMemoryStorage(),
  });
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: window[name],
  });
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');

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
