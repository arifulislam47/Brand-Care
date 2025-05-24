import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyBm_LTts_gQ94KuRzb_-h5A0btxoU_xjeE",
  authDomain: "brand-care-b152e.firebaseapp.com",
  projectId: "brand-care-b152e",
  storageBucket: "brand-care-b152e.firebasestorage.app",
  messagingSenderId: "873548866972",
  appId: "1:873548866972:web:e9caf10e59a0c4bf5f5459",
  measurementId: "G-RPBCVKTKE4"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Analytics (only in browser environment)
let analytics = null;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { app, auth, db, analytics }; 