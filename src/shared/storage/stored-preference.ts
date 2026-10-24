/*
 * One owner for a preference that lives in storage and is read in two places.
 *
 * With `useState`, each caller keeps its own copy and they disagree the moment
 * one of them writes: the model picker and the privacy disclosure beside it
 * went on naming the host of a model that was no longer selected, which is the
 * one thing on that list that has to be true. A single store behind
 * `useSyncExternalStore` fixes it, and the plumbing for that store - a set of
 * listeners, a cached value, a setter that writes through and notifies - had
 * been written out three times.
 *
 * Deliberately not a hook. `useSyncExternalStore` belongs in the `useX`
 * function beside the preference it serves, so the rules of hooks still apply
 * where they can be checked; what is shared is the store, not the subscription.
 */

/** Returned by `createStoredPreference`; nobody else builds one. */
interface StoredPreference<T> {
  /**
   * The current value, read from storage the first time it is asked for.
   *
   * Lazy because storage may not be readable when a module is first
   * evaluated, and because a preference nothing reads should cost nothing.
   */
  snapshot: () => T;
  subscribe: (listener: () => void) => () => void;
  /** Writes through to storage and tells every subscriber. */
  set: (value: T) => void;
}

export function createStoredPreference<T>(
  read: () => T,
  write: (value: T) => void,
): StoredPreference<T> {
  const listeners = new Set<() => void>();
  /* Boxed, so a cached `false` or `""` is still a cached value. */
  let cached: { value: T } | null = null;

  const snapshot = (): T => {
    cached ??= { value: read() };
    return cached.value;
  };

  return {
    snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (value) => {
      if (value === snapshot()) return;
      cached = { value };
      write(value);
      for (const listener of listeners) listener();
    },
  };
}
