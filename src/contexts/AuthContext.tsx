'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { 
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { exportedAuth as firebaseAuth, exportedDb as firebaseDb } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isManager: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, isManager: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  const fetchUserData = useCallback(async (currentUser: User) => {
    try {
      const userDocRef = doc(firebaseDb, 'users', currentUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        const timestamp = new Date().toISOString();
        await setDoc(userDocRef, {
          email: currentUser.email,
          isManager: false,
          name: '',
          createdAt: timestamp
        });
        setIsManager(false);
      } else {
        setIsManager(userDoc.data()?.isManager || false);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setIsManager(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    console.log('AuthProvider mounted, initializing...');
    let unsubscribe: () => void;

    // Wait for Firebase Auth to be ready
    const initAuth = () => {
      if (!firebaseAuth) {
        console.log('Firebase Auth not ready, retrying...');
        setTimeout(initAuth, 100);
        return;
      }

      try {
        unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
          console.log('Auth state changed:', currentUser?.email);
          setUser(currentUser);
          
          if (currentUser) {
            await fetchUserData(currentUser);
          } else {
            setIsManager(false);
          }
          
          setLoading(false);
          setAuthInitialized(true);
        });
      } catch (error) {
        console.error('Error in auth state observer:', error);
        setLoading(false);
        setAuthInitialized(true);
      }
    };

    initAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [fetchUserData]);

  const signUp = useCallback(async (email: string, password: string, name: string, isManager: boolean) => {
    if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
    
    try {
      setLoading(true);
      const { user } = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const timestamp = new Date().toISOString();
      await setDoc(doc(firebaseDb, 'users', user.uid), {
        email,
        name,
        isManager,
        createdAt: timestamp
      });
    } catch (error) {
      console.error('Error during sign up:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
    
    try {
      setLoading(true);
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    } catch (error) {
      console.error('Error during sign in:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!firebaseAuth) throw new Error('Firebase Auth not initialized');
    
    try {
      setLoading(true);
      await signOut(firebaseAuth);
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isManager,
    signIn,
    signUp,
    logout
  }), [user, loading, isManager, signIn, signUp, logout]);

  if (!authInitialized) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Initializing authentication...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 