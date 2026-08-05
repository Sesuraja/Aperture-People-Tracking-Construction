import { collection, doc, setDoc, serverTimestamp, getDoc } from './db';
import { db } from './firebase';
import { gaoApi, RealtimeTag } from './gaoApi';

let isSyncing = false;
let syncInterval: NodeJS.Timeout | null = null;

export function startGaoSync() {
  if (isSyncing) return;
  isSyncing = true;
  console.log('Started GAO to Firestore Sync Service');

  syncInterval = setInterval(async () => {
    try {
      const tags = await gaoApi.getTagsInRealtime();
      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        if (tags && !Array.isArray(tags)) {
          console.warn('Realtime tags synchronization returned non-array:', tags);
        }
        return;
      }
      
      const batchPromises = tags.map(async (tag: RealtimeTag) => {
        const tagRef = doc(db, 'live_tags', tag.TagID);
        // Use setDoc with merge: true to avoid duplicates and update latest state
        await setDoc(tagRef, {
          TagID: tag.TagID,
          Location: tag.Location,
          Timestamp: tag.Timestamp,
          lastSeen: serverTimestamp()
        }, { merge: true });
      });

      await Promise.allSettled(batchPromises);
    } catch (e) {
      console.error('Error syncing GAO data to Firestore:', e);
    }
  }, 3000); // Poll every 3 seconds
}

export function stopGaoSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  isSyncing = false;
  console.log('Stopped GAO to Firestore Sync Service');
}
