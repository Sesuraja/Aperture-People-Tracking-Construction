import { 
  collection as fbCollection, 
  doc as fbDoc, 
  setDoc as fbSetDoc, 
  addDoc as fbAddDoc, 
  getDoc as fbGetDoc, 
  getDocs as fbGetDocs, 
  updateDoc as fbUpdateDoc, 
  deleteDoc as fbDeleteDoc, 
  query as fbQuery, 
  orderBy as fbOrderBy, 
  limit as fbLimit, 
  serverTimestamp as fbServerTimestamp, 
  onSnapshot as fbOnSnapshot, 
  getCountFromServer as fbGetCountFromServer 
} from 'firebase/firestore';
import { db as firebaseDb } from './firebase';

export function isMongoActive(): boolean {
  return true;
}

export const db = firebaseDb;

export function serverTimestamp() {
  if (isMongoActive()) {
    return new Date().toISOString();
  }
  try {
    return fbServerTimestamp();
  } catch {
    return new Date().toISOString();
  }
}

function getRefInfo(ref: any): { colName: string; docId?: string } {
  if (!ref) return { colName: 'unknown' };
  if (typeof ref === 'string') return { colName: ref };
  if (ref.col) return { colName: ref.col, docId: ref.id };
  if (ref.path) {
    const parts = ref.path.split('/').filter(Boolean);
    if (parts.length === 1) return { colName: parts[0] };
    if (parts.length >= 2) return { colName: parts[0], docId: parts[parts.length - 1] };
  }
  return { colName: ref.id || 'unknown' };
}

export function collection(dbInstance: any, colName: string): any {
  if (isMongoActive()) {
    return { type: 'collection', path: colName };
  }
  const targetDb = (dbInstance && Object.keys(dbInstance).length > 0) ? dbInstance : firebaseDb;
  return fbCollection(targetDb, colName);
}

export function doc(dbInstanceOrColRef: any, colNameOrId: string, maybeId?: string): any {
  if (isMongoActive()) {
    if (maybeId) return { type: 'doc', col: colNameOrId, id: maybeId };
    if (typeof dbInstanceOrColRef === 'string') return { type: 'doc', col: dbInstanceOrColRef, id: colNameOrId };
    if (dbInstanceOrColRef?.path) return { type: 'doc', col: dbInstanceOrColRef.path, id: colNameOrId };
    return { type: 'doc', col: colNameOrId, id: maybeId };
  }
  if (maybeId) {
    const targetDb = (dbInstanceOrColRef && Object.keys(dbInstanceOrColRef).length > 0) ? dbInstanceOrColRef : firebaseDb;
    return fbDoc(targetDb, colNameOrId, maybeId);
  }
  if (typeof dbInstanceOrColRef === 'string') {
    return fbDoc(firebaseDb, dbInstanceOrColRef, colNameOrId);
  }
  return fbDoc(dbInstanceOrColRef, colNameOrId);
}

export function query(colRef: any, ...constraints: any[]): any {
  if (isMongoActive()) {
    return colRef;
  }
  return fbQuery(colRef, ...constraints);
}

export function orderBy(field: string, direction?: 'asc' | 'desc') {
  if (isMongoActive()) {
    return { type: 'orderBy', field, direction: direction || 'asc' };
  }
  return fbOrderBy(field, direction || 'asc');
}

export function limit(value: number) {
  if (isMongoActive()) {
    return { type: 'limit', value };
  }
  return fbLimit(value);
}

function createMockDoc(data: any) {
  if (!data) return { id: 'unknown', exists: () => false, data: () => null };
  const idValue = data.id || data._id || 'unknown';
  
  const wrappedData = { ...data };
  Object.keys(wrappedData).forEach(key => {
    const val = wrappedData[key];
    // Strictly convert timestamp/createdAt/updatedAt fields to Firestore-compatible Timestamp objects if needed
    if (val && (key === 'timestamp' || key === 'createdAt' || key === 'updatedAt')) {
      if (typeof val === 'string') {
        const dateObj = new Date(val);
        if (!isNaN(dateObj.getTime())) {
          wrappedData[key] = {
            toDate: () => dateObj,
            seconds: Math.floor(dateObj.getTime() / 1000),
            nanoseconds: (dateObj.getTime() % 1000) * 1e6,
            toString: () => val,
            valueOf: () => dateObj.getTime()
          };
        }
      } else if (val instanceof Date) {
        wrappedData[key] = {
          toDate: () => val,
          seconds: Math.floor(val.getTime() / 1000),
          nanoseconds: (val.getTime() % 1000) * 1e6,
          toString: () => val.toISOString(),
          valueOf: () => val.getTime()
        };
      }
    }
  });

  return {
    id: idValue,
    ref: { id: idValue },
    data: () => wrappedData,
    exists: () => true
  };
}

function createMockSnapshot(docsData: any[]) {
  const mockDocs = (docsData || []).map(d => createMockDoc(d));
  return {
    docs: mockDocs,
    empty: mockDocs.length === 0,
    size: mockDocs.length,
    forEach: (callback: (d: any) => void) => {
      mockDocs.forEach(callback);
    }
  };
}

export async function setDoc(docRef: any, data: any, options?: any): Promise<void> {
  if (isMongoActive()) {
    const { colName, docId } = getRefInfo(docRef);
    if (!colName || !docId) return;
    try {
      const response = await fetch(`/api/data/${colName}/${docId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      console.warn(`setDoc MongoDB API error for ${colName}/${docId}:`, err);
    }
    return;
  }
  try {
    if (options) {
      return await fbSetDoc(docRef, data, options);
    }
    return await fbSetDoc(docRef, data);
  } catch (err: any) {
    console.warn('Firestore setDoc failed, falling back to REST API:', err?.message || err);
    const { colName, docId } = getRefInfo(docRef);
    if (colName && docId) {
      try {
        await fetch(`/api/data/${colName}/${docId}`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(data)
        });
      } catch (restErr) {
        console.warn(`REST setDoc fallback error for ${colName}/${docId}:`, restErr);
      }
    }
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('gao_jwt_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function safeJsonFetch(url: string, options?: RequestInit): Promise<any> {
  const customOptions = options || {};
  customOptions.headers = {
    ...getAuthHeaders(),
    ...(customOptions.headers || {})
  };
  const response = await fetch(url, customOptions);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid JSON output: ${text.slice(0, 100)}`);
  }
}

export async function addDoc(colRef: any, data: any): Promise<any> {
  if (isMongoActive()) {
    const { colName } = getRefInfo(colRef);
    try {
      const result = await safeJsonFetch(`/api/data/${colName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const savedDoc = result?.doc || result || data;
      const docId = savedDoc.id || data.id || Math.random().toString(36).substring(2, 11);
      return { id: docId, ...createMockDoc({ ...savedDoc, id: docId }) };
    } catch (err) {
      console.warn(`addDoc MongoDB API error for ${colName}:`, err);
      const newId = data.id || Math.random().toString(36).substring(2, 11);
      return { id: newId, ...createMockDoc({ id: newId, ...data }) };
    }
  }
  try {
    return await fbAddDoc(colRef, data);
  } catch (err: any) {
    console.warn('Firestore addDoc failed, falling back to REST API:', err?.message || err);
    const { colName } = getRefInfo(colRef);
    const newId = data.id || Math.random().toString(36).substring(2, 11);
    if (colName) {
      try {
        const result = await safeJsonFetch(`/api/data/${colName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, id: newId })
        });
        const savedDoc = result?.doc || result || data;
        return { id: newId, ...createMockDoc({ ...savedDoc, id: newId }) };
      } catch {}
    }
    return { id: newId, ...createMockDoc({ id: newId, ...data }) };
  }
}

export async function getDoc(docRef: any): Promise<any> {
  if (isMongoActive()) {
    const { colName, docId } = getRefInfo(docRef);
    try {
      const result = await safeJsonFetch(`/api/data/${colName}/${docId}`);
      const docObj = result?.doc || (result?.id ? result : null);
      if (docObj) return createMockDoc(docObj);
    } catch (err) {
      console.warn(`getDoc MongoDB API error for ${colName}/${docId}:`, err);
    }
    return { id: docId || 'unknown', exists: () => false, data: () => null };
  }
  try {
    return await fbGetDoc(docRef);
  } catch (err: any) {
    console.warn('Firestore getDoc failed, falling back to REST API:', err?.message || err);
    const { colName, docId } = getRefInfo(docRef);
    if (colName && docId) {
      try {
        const result = await safeJsonFetch(`/api/data/${colName}/${docId}`);
        const docObj = result?.doc || (result?.id ? result : null);
        if (docObj) return createMockDoc(docObj);
      } catch {}
    }
    return { id: docId || 'unknown', exists: () => false, data: () => null };
  }
}

export async function getDocs(queryRef: any): Promise<any> {
  if (isMongoActive()) {
    const { colName } = getRefInfo(queryRef);
    try {
      const result = await safeJsonFetch(`/api/data/${colName}`);
      const docsArray = Array.isArray(result) ? result : (result?.data || []);
      return createMockSnapshot(docsArray);
    } catch (err) {
      console.warn(`getDocs MongoDB API error for ${colName}:`, err);
    }
    return createMockSnapshot([]);
  }
  try {
    return await fbGetDocs(queryRef);
  } catch (err: any) {
    console.warn('Firestore getDocs failed, falling back to REST API:', err?.message || err);
    const { colName } = getRefInfo(queryRef);
    if (colName) {
      try {
        const result = await safeJsonFetch(`/api/data/${colName}`);
        const docsArray = Array.isArray(result) ? result : (result?.data || []);
        return createMockSnapshot(docsArray);
      } catch {}
    }
    return createMockSnapshot([]);
  }
}

export async function updateDoc(docRef: any, data: any): Promise<void> {
  if (isMongoActive()) {
    return setDoc(docRef, data, { merge: true });
  }
  try {
    return await fbUpdateDoc(docRef, data);
  } catch (err: any) {
    console.warn('Firestore updateDoc failed, falling back to REST API:', err?.message || err);
    return setDoc(docRef, data, { merge: true });
  }
}

export async function deleteDoc(docRef: any): Promise<void> {
  if (isMongoActive()) {
    const { colName, docId } = getRefInfo(docRef);
    try {
      await fetch(`/api/data/${colName}/${docId}`, { method: 'DELETE', headers: getAuthHeaders() });
    } catch (err) {
      console.warn(`deleteDoc MongoDB API error for ${colName}/${docId}:`, err);
    }
    return;
  }
  try {
    return await fbDeleteDoc(docRef);
  } catch (err: any) {
    console.warn('Firestore deleteDoc failed, falling back to REST API:', err?.message || err);
    const { colName, docId } = getRefInfo(docRef);
    if (colName && docId) {
      try {
        await fetch(`/api/data/${colName}/${docId}`, { method: 'DELETE', headers: getAuthHeaders() });
      } catch {}
    }
  }
}

export async function getCountFromServer(queryRef: any): Promise<any> {
  if (isMongoActive()) {
    const { colName } = getRefInfo(queryRef);
    try {
      const result = await safeJsonFetch(`/api/data/${colName}`);
      const docsArray = Array.isArray(result) ? result : (result?.data || []);
      const count = docsArray.length;
      return { data: () => ({ count }) };
    } catch (err) {}
    return { data: () => ({ count: 0 }) };
  }
  try {
    return await fbGetCountFromServer(queryRef);
  } catch (err: any) {
    const { colName } = getRefInfo(queryRef);
    if (colName) {
      try {
        const result = await safeJsonFetch(`/api/data/${colName}`);
        const docsArray = Array.isArray(result) ? result : (result?.data || []);
        return { data: () => ({ count: docsArray.length }) };
      } catch {}
    }
    return { data: () => ({ count: 0 }) };
  }
}

export function onSnapshot(ref: any, callback: (snapshot: any) => void, errorCallback?: (error: any) => void): () => void {
  if (isMongoActive()) {
    let active = true;
    const { colName, docId } = getRefInfo(ref);

    const poll = async () => {
      if (!active) return;
      try {
        if (docId) {
          const result = await safeJsonFetch(`/api/data/${colName}/${docId}`);
          if (active && result) {
            const docObj = result?.doc || (result?.id ? result : null);
            if (docObj) callback(createMockDoc(docObj));
          }
        } else {
          const result = await safeJsonFetch(`/api/data/${colName}`);
          if (active && result) {
            const docsArray = Array.isArray(result) ? result : (result?.data || []);
            callback(createMockSnapshot(docsArray));
          }
        }
      } catch (err) {
        if (errorCallback) {
          try { errorCallback(err); } catch {}
        }
      }
    };

    poll();
    const interval = setInterval(poll, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }

  let isPollingFallback = false;
  let pollingInterval: any = null;
  let active = true;

  const startPollingFallback = () => {
    if (isPollingFallback || !active) return;
    isPollingFallback = true;
    const { colName, docId } = getRefInfo(ref);

    const poll = async () => {
      if (!active) return;
      try {
        if (docId) {
          const result = await safeJsonFetch(`/api/data/${colName}/${docId}`);
          if (active && result) {
            const docObj = result?.doc || (result?.id ? result : null);
            if (docObj) callback(createMockDoc(docObj));
          }
        } else if (colName) {
          const result = await safeJsonFetch(`/api/data/${colName}`);
          if (active && result) {
            const docsArray = Array.isArray(result) ? result : (result?.data || []);
            callback(createMockSnapshot(docsArray));
          }
        }
      } catch {}
    };

    poll();
    pollingInterval = setInterval(poll, 4000);
  };

  try {
    const unsub = fbOnSnapshot(
      ref,
      callback,
      (err) => {
        console.warn('Firestore snapshot listener connection issue, switching to polling fallback:', err?.message || err);
        startPollingFallback();
        if (errorCallback) {
          try { errorCallback(err); } catch {}
        }
      }
    );

    return () => {
      active = false;
      if (pollingInterval) clearInterval(pollingInterval);
      try { unsub(); } catch {}
    };
  } catch (setupErr) {
    console.warn('fbOnSnapshot setup failed, starting REST polling fallback:', setupErr);
    startPollingFallback();
    return () => {
      active = false;
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }
}




