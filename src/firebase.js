import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  initializeAuth
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const requiredFirebaseKeys = ["apiKey", "authDomain", "projectId", "appId"];
const hasValidFirebaseConfig = requiredFirebaseKeys.every(key => {
  const value = firebaseConfig[key];
  return typeof value === "string" && value.trim() && value !== "undefined";
});

let auth = null;
let db = null;
let googleProvider = null;
let firebaseEnabled = false;
let firebaseInitError = "";

if (hasValidFirebaseConfig) {
  try {
    const app = initializeApp(firebaseConfig);

    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
      popupRedirectResolver: browserPopupRedirectResolver
    });

    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager()
      })
    });

    googleProvider = new GoogleAuthProvider();
    googleProvider.addScope("email");
    googleProvider.setCustomParameters({
      prompt: "select_account"
    });

    firebaseEnabled = true;
  } catch (error) {
    firebaseInitError = error?.message || "No se pudo inicializar Firebase.";
    console.warn("Firebase deshabilitado. La app seguirá en modo local.", error);
  }
} else {
  firebaseInitError = "Falta configuración de Firebase.";
  console.warn("Firebase deshabilitado. Faltan variables VITE_FIREBASE_*.");
}

export { auth, db, googleProvider, firebaseEnabled, firebaseInitError };