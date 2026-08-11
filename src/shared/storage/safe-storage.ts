export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): boolean;
  removeItem(key: string): boolean;
}

type StorageResolver = () => Storage | null;

function resolveBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function createSafeStorage(
  resolveStorage: StorageResolver = resolveBrowserStorage,
): SafeStorage {
  return {
    getItem(key) {
      try {
        return resolveStorage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        const storage = resolveStorage();
        if (!storage) return false;
        storage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    removeItem(key) {
      try {
        const storage = resolveStorage();
        if (!storage) return false;
        storage.removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const safeStorage = createSafeStorage();

export function readStoredJson<T>(key: string, fallback: T): T {
  const value = safeStorage.getItem(key);
  if (value === null) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown): boolean {
  try {
    return safeStorage.setItem(key, JSON.stringify(value));
  } catch {
    return false;
  }
}
