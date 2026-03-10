import '@testing-library/jest-dom/vitest';

(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = 'test-version';
(globalThis as { __GIT_BRANCH__?: string }).__GIT_BRANCH__ = 'test-branch';

function createStorageMock(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
  };
}

function ensureStorage(name: 'localStorage' | 'sessionStorage') {
  const current = globalThis[name];

  if (current && typeof current.setItem === 'function' && typeof current.getItem === 'function') {
    if (typeof current.clear !== 'function') {
      Object.defineProperty(current, 'clear', {
        configurable: true,
        value() {
          const keys: string[] = [];

          if (typeof current.length === 'number' && typeof current.key === 'function') {
            for (let index = 0; index < current.length; index += 1) {
              const key = current.key(index);
              if (key !== null) {
                keys.push(key);
              }
            }
          }

          if (keys.length === 0) {
            for (const key of Object.keys(current)) {
              if (current.getItem(key) !== null) {
                keys.push(key);
              }
            }
          }

          for (const key of keys) {
            current.removeItem(key);
          }
        },
      });
    }

    return;
  }

  const mock = createStorageMock();
  Object.defineProperty(window, name, {
    configurable: true,
    value: mock,
  });
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: mock,
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
