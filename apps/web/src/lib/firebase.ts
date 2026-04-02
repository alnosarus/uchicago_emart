import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type Auth } from "firebase/auth";

let app: FirebaseApp | undefined;
let authInstance: Auth | undefined;

function getFirebaseApp() {
  if (typeof window === "undefined") return undefined;
  if (app) return app;

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };

  app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  return app;
}

export function getFirebaseAuth(): Auth {
  if (authInstance) return authInstance;
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) throw new Error("Firebase not available on server");
  authInstance = getAuth(firebaseApp);
  return authInstance;
}

export { RecaptchaVerifier, signInWithPhoneNumber };
