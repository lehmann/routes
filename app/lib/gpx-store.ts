const DB_NAME = 'routes';
const STORE = 'gpx';

export interface StoredGpx {
  id: string;
  name: string;
  xml: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export const listStoredGpx = () => run<StoredGpx[]>('readonly', s => s.getAll());

export const saveStoredGpx = (item: StoredGpx) => run('readwrite', s => s.put(item));

export const deleteStoredGpx = (id: string) => run('readwrite', s => s.delete(id));
