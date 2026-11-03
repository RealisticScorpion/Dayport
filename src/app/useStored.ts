import { useCallback, useEffect, useState } from "react";
import { loadKey, mutateKey, watchKey, type Codec } from "../data/storage";

/**
 * A small stored collection kept under its own key (continue later, discovery
 * preferences). Every update re-reads storage first, so a page never writes
 * back a stale copy over something the popup or another page saved.
 */
export function useStored<T>(key: string, codec: Codec<T>) {
  const [value, setValue] = useState<T | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadKey(key).then(
      (raw) => !cancelled && setValue(codec.read(raw)),
      () => !cancelled && setValue(codec.read(undefined)),
    );
    const stop = watchKey(key, (raw) => setValue(codec.read(raw)));
    return () => {
      cancelled = true;
      stop();
    };
  }, [key, codec]);

  /** Resolves false when the write failed; the stored value is then unchanged. */
  const update = useCallback(
    async (edit: (value: T) => T) => {
      try {
        setValue(await mutateKey(key, codec, edit));
        return true;
      } catch {
        return false;
      }
    },
    [key, codec],
  );

  return { value, update };
}
