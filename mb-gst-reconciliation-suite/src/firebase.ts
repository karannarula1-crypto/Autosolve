import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export type UserRole = 'admin' | 'portal_action' | 'view_only';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  isAuthorized: boolean;
  displayName: string;
  photoURL: string;
  createdAt?: any;
}

export const signIn = () => signInWithPopup(auth, googleProvider);
export const logOut = () => signOut(auth);

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
};

export const createUserProfile = async (user: FirebaseUser): Promise<UserProfile> => {
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    role: 'view_only', // Default role
    isAuthorized: user.email === 'karan.narula1@magicbricks.com', // Bootstrap admin
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    createdAt: serverTimestamp()
  };
  
  if (user.email === 'karan.narula1@magicbricks.com') {
    profile.role = 'admin';
  }

  await setDoc(doc(db, 'users', user.uid), profile);
  return profile;
};

export interface ActivityLog {
  id?: string;
  type: 'upload' | 'email' | 'report' | 'auth';
  title: string;
  description?: string;
  userEmail: string;
  userId: string;
  timestamp: any;
  metadata?: any;
}

export const logActivity = async (activity: Omit<ActivityLog, 'timestamp'>) => {
  const activityRef = doc(collection(db, 'activity'));
  await setDoc(activityRef, {
    ...activity,
    timestamp: serverTimestamp()
  });
};

export const deleteActivity = async (activityId: string) => {
  const activityRef = doc(db, 'activity', activityId);
  await deleteDoc(activityRef);
};
