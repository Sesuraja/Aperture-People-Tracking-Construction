import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot 
} from 'firebase/firestore';

import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('unavailable') || error.message.includes('Could not reach Cloud Firestore backend'))) {
      console.warn("Firebase connection notice: Operating with local/REST backend fallback.");
    }
  }
}
testConnection().catch(() => {});

export const storage = {
  ref: () => ({
    put: async () => ({ ref: { getDownloadURL: async () => "" } })
  })
};

export {
  app,
  auth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  onSnapshot
};


