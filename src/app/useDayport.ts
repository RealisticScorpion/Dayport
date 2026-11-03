import { useCallback, useEffect, useRef, useState } from "react";
import { migrate } from "../data/migrate";
import type { DayportData } from "../data/schema";
import { loadRaw, save, watch } from "../data/storage";

export type StoreStatus = "loading" | "ready" | "unreadable";

export interface DayportStore {
  status: StoreStatus;
  data: DayportData | null;
  /** True while the latest change exists only in memory because the last write failed. */
  unsaved: boolean;
  /** Applies an edit, renders it immediately, and persists it. Resolves false if the write failed. */
  apply: (edit: (data: DayportData) => DayportData) => Promise<boolean>;
  retry: () => Promise<boolean>;
}

export function useDayport(): DayportStore {
  const [status, setStatus] = useState<StoreStatus>("loading");
  const [data, setData] = useState<DayportData | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const dataRef = useRef<DayportData | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const lastWritten = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadRaw()
      .then((raw) => {
        if (cancelled) return;
        const result = migrate(raw);
        if (!result.ok) return setStatus("unreadable");
        dataRef.current = result.data;
        setData(result.data);
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("unreadable"));

    // Another open new tab page or the options page changed the document.
    const stop = watch((raw) => {
      const result = migrate(raw);
      if (!result.ok) return;
      if (result.data.updatedAt === lastWritten.current) return;
      dataRef.current = result.data;
      setData(result.data);
      setUnsaved(false);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const persist = useCallback((next: DayportData) => {
    // Writes run one at a time so a slow write can never land after a newer one.
    const write = chain.current.then(async () => {
      lastWritten.current = next.updatedAt;
      await save(next);
    });
    chain.current = write.catch(() => undefined);
    return write.then(
      () => {
        if (dataRef.current === next) setUnsaved(false);
        return true;
      },
      () => {
        setUnsaved(true);
        return false;
      },
    );
  }, []);

  const apply = useCallback(
    (edit: (data: DayportData) => DayportData) => {
      const current = dataRef.current;
      if (!current) return Promise.resolve(false);
      const next = edit(current);
      if (next === current) return Promise.resolve(true);
      dataRef.current = next;
      setData(next);
      return persist(next);
    },
    [persist],
  );

  const retry = useCallback(() => {
    const current = dataRef.current;
    return current ? persist(current) : Promise.resolve(false);
  }, [persist]);

  return { status, data, unsaved, apply, retry };
}
