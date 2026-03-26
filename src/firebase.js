import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDOzaWazKdlYhP75PY8X0Y3-byhFT8iVYc",
  authDomain: "blogeekplatzi-d97a4.firebaseapp.com",
  projectId: "blogeekplatzi-d97a4",
  storageBucket: "blogeekplatzi-d97a4.firebasestorage.app",
  messagingSenderId: "168008095795",
  appId: "1:168008095795:web:00172cbe1521ffc4732b46",
  measurementId: "G-G4RL05137K"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

enableIndexedDbPersistence(db).catch(() => {
  // Ignorar en desarrollo si ya hay otra pestaña abierta o el navegador no lo soporta
});

export { auth, db, googleProvider };