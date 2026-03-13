/**
 * Vitest global setup — runs after jsdom environment init, before test files.
 *
 * Node >= 25 ships a built-in `globalThis.localStorage` (a plain object with
 * no Storage methods like clear/getItem/setItem).  In vitest's jsdom
 * environment, `window` === `globalThis`, so jsdom cannot install its own
 * proper Storage — the Node built-in wins.  This causes
 * `localStorage.clear is not a function` across every test that touches
 * storage.
 *
 * Fix: replace the broken built-in with a spec-compliant in-memory Storage.
 */

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
}

if (typeof globalThis.localStorage?.clear !== 'function') {
  const storage = createStorage()
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    writable: true,
    configurable: true,
  })
}

if (typeof globalThis.sessionStorage?.clear !== 'function') {
  const storage = createStorage()
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    writable: true,
    configurable: true,
  })
}
