// Local background images live in IndexedDB (docs/architecture.md, Storage):
// they are too large for extension storage and never leave the device.

export interface LocalImage {
  id: string;
  name: string;
  blob: Blob;
  /** Focal point in percent, applied as object-position. */
  focalX: number;
  focalY: number;
  addedAt: number;
}

const DB_NAME = "dayport";
const STORE = "images";
const channel =
  typeof BroadcastChannel === "function" ? new BroadcastChannel("dayport-images") : null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function changed() {
  channel?.postMessage("changed");
}

export async function listImages(): Promise<LocalImage[]> {
  const images = (await run<LocalImage[]>("readonly", (store) => store.getAll())) ?? [];
  return images.sort((a, b) => a.addedAt - b.addedAt);
}

export async function addImages(images: LocalImage[]): Promise<void> {
  await run("readwrite", (store) => {
    for (const image of images) store.put(image);
  });
  changed();
}

export async function updateImage(
  id: string,
  patch: Partial<Pick<LocalImage, "focalX" | "focalY">>,
) {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const get = store.get(id);
      get.onsuccess = () => {
        if (get.result) store.put({ ...get.result, ...patch });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  changed();
}

export async function removeImage(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
  changed();
}

export async function clearImages(): Promise<void> {
  await run("readwrite", (store) => store.clear());
  changed();
}

/** Calls `onChange` when another page adds, edits, or removes an image. */
export function watchImages(onChange: () => void): () => void {
  if (typeof BroadcastChannel !== "function") return () => {};
  const listener = new BroadcastChannel("dayport-images");
  listener.onmessage = onChange;
  return () => listener.close();
}
