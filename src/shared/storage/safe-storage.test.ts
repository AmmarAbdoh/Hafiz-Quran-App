import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSafeStorage,
  readStoredJson,
  safeStorage,
  writeStoredJson,
} from "./safe-storage";

function createMemoryStorage(values = new Map<string, string>()): Storage {
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => [...values.keys()][index] ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createSafeStorage", () => {
  it("reads, writes, and removes values when storage is available", () => {
    const values = new Map<string, string>();
    const storage = createMemoryStorage(values);
    const safeStorage = createSafeStorage(() => storage);

    expect(safeStorage.setItem("locale", "ar")).toBe(true);
    expect(safeStorage.getItem("locale")).toBe("ar");
    expect(safeStorage.removeItem("locale")).toBe(true);
    expect(safeStorage.getItem("locale")).toBeNull();
  });

  it("never throws when browser storage is unavailable or blocked", () => {
    const unavailable = createSafeStorage(() => null);
    const blocked = createSafeStorage(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(unavailable.getItem("locale")).toBeNull();
    expect(unavailable.setItem("locale", "en")).toBe(false);
    expect(unavailable.removeItem("locale")).toBe(false);
    expect(blocked.getItem("locale")).toBeNull();
    expect(blocked.setItem("locale", "en")).toBe(false);
    expect(blocked.removeItem("locale")).toBe(false);
  });

  it("contains failures from individual storage methods", () => {
    const storage = {
      getItem: () => {
        throw new DOMException("Read blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("Write blocked", "QuotaExceededError");
      },
      removeItem: () => {
        throw new DOMException("Delete blocked", "SecurityError");
      },
    } as unknown as Storage;
    const guarded = createSafeStorage(() => storage);

    expect(guarded.getItem("locale")).toBeNull();
    expect(guarded.setItem("locale", "ar")).toBe(false);
    expect(guarded.removeItem("locale")).toBe(false);
  });

  it("uses the default adapter safely outside a browser", () => {
    vi.stubGlobal("window", undefined);

    expect(safeStorage.getItem("locale")).toBeNull();
    expect(safeStorage.setItem("locale", "ar")).toBe(false);
    expect(safeStorage.removeItem("locale")).toBe(false);
  });
});

describe("stored JSON helpers", () => {
  it("round-trips JSON through the guarded browser adapter", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: createMemoryStorage(values) });

    expect(writeStoredJson("preferences", { locale: "en" })).toBe(true);
    expect(readStoredJson("preferences", { locale: "ar" })).toEqual({
      locale: "en",
    });
  });

  it("returns the caller's fallback for missing or malformed JSON", () => {
    const values = new Map<string, string>([["broken", "{not-json"]]);
    vi.stubGlobal("window", { localStorage: createMemoryStorage(values) });
    const fallback = { locale: "ar" };

    expect(readStoredJson("missing", fallback)).toBe(fallback);
    expect(readStoredJson("broken", fallback)).toBe(fallback);
  });

  it("reports serialization failures without touching storage", () => {
    const storage = createMemoryStorage();
    const setItem = vi.spyOn(storage, "setItem");
    vi.stubGlobal("window", { localStorage: storage });
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(writeStoredJson("circular", circular)).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });
});
