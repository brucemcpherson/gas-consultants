import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import firebaseConfig from "../firebase-applet-config.json";
import { Contributor } from "./types";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Critical: The app will break without this line! Specifying the databaseId from the config
export const db = (firebaseConfig as any).firestoreDatabaseId && (firebaseConfig as any).firestoreDatabaseId !== "(default)"
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

// Provider Setup
const provider = new GoogleAuthProvider();
// No sensitive scopes added here anymore to avoid triggering Google verification and organization blocks.

// In-memory access token cache
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // We have signed in but don't have the token in-memory (e.g. page refreshed)
        // If they need Google Slides access they will trigger signIn again, otherwise they have core auth
        if (onAuthSuccess) onAuthSuccess(user, "");
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Google sign-in using popups (as recommended for AI Studio sandboxes)
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    cachedAccessToken = credential?.accessToken || "";
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Firebase/Google authentication error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Log out and clear state
export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const getAccessToken = () => {
  return cachedAccessToken;
};

// STRICT Compliance error handling for permissions
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error Exception:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Utility to check if a user acts as admin
export function isUserAdmin(user: User | null, list?: Contributor[]): boolean {
  if (!user) return false;
  if (user.email?.toLowerCase() === "bruce@mcpher.com") return true;
  if (list) {
    const profile = list.find((c) => c.userId === user.uid || (c.email && c.email.toLowerCase() === user.email?.toLowerCase()));
    return profile?.systemRole === "admin";
  }
  return false;
}
