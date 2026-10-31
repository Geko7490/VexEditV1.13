const DATABASE_NAME = "vexedit-media";
const DATABASE_VERSION = 1;
const STORE_NAME = "files";
const objectUrlCache = new Map<string, string>();

interface StoredMediaRecord {
  id: string;
  blob: Blob;
  name: string;
  mimeType: string;
  createdAt: number;
}

function openMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Persistent media storage is not available in this WebView."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open media storage."));
  });
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `media_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Save an imported file in IndexedDB and return a stable project-safe reference. */
export async function saveMediaFile(file: File): Promise<string> {
  const database = await openMediaDatabase();
  const id = makeId();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      id,
      blob: file,
      name: file.name,
      mimeType: file.type,
      createdAt: Date.now(),
    } satisfies StoredMediaRecord);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Could not save imported media."));
    transaction.onabort = () => reject(transaction.error || new Error("Media save was cancelled."));
  });
  database.close();
  return `vexmedia://${id}`;
}

/** Resolve a stable IndexedDB media reference to a cached object URL for playback. */
export async function resolveMediaSource(source?: string): Promise<string | undefined> {
  if (!source) return undefined;
  if (!source.startsWith("vexmedia://")) return source;

  const cached = objectUrlCache.get(source);
  if (cached) return cached;

  const id = source.slice("vexmedia://".length);
  const database = await openMediaDatabase();
  const record = await new Promise<StoredMediaRecord | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as StoredMediaRecord | undefined);
    request.onerror = () => reject(request.error || new Error("Could not read imported media."));
  });
  database.close();

  if (!record?.blob) {
    throw new Error(`Imported media is missing from local storage: ${record?.name || id}`);
  }
  const url = URL.createObjectURL(record.blob);
  objectUrlCache.set(source, url);
  return url;
}
