import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyBm_LTts_gQ94KuRzb_-h5A0btxoU_xjeE",
  authDomain: "brand-care-b152e.firebaseapp.com",
  projectId: "brand-care-b152e",
  storageBucket: "brand-care-b152e.firebasestorage.app",
  messagingSenderId: "873548866972",
  appId: "1:873548866972:web:e9caf10e59a0c4bf5f5459",
  measurementId: "G-RPBCVKTKE4"
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let analytics: Analytics | undefined = null;
let initialized = false;

function initializeFirebase() {
  if (typeof window === 'undefined') return null;
  if (initialized) return { app, auth, db, analytics };

  try {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Set persistence
    if (auth) {
      setPersistence(auth, browserLocalPersistence).catch((error) => {
        console.error('Error setting persistence:', error);
      });
    }

    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      analytics = getAnalytics(app);
    }

    initialized = true;
    console.log('Firebase initialized successfully');
    return { app, auth, db, analytics };
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return null;
  }
}

// Initialize Firebase when this module is imported
const firebase = initializeFirebase();

// Export initialized instances
export const { auth: exportedAuth, db: exportedDb, analytics: exportedAnalytics } = firebase || {};
export { app };

// Export initialization status
export const isInitialized = () => initialized; 