import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAXw6LdRFL3iM_e97amJDrVEzfuyYC9N6w",
  authDomain: "music-b3be5.firebaseapp.com",
  projectId: "music-b3be5",
  storageBucket: "music-b3be5.firebasestorage.app",
  messagingSenderId: "593321664127",
  appId: "1:593321664127:web:6dfd06ff59f860a44d694a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use initializeFirestore with long-polling for better reliability in some environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const storage = getStorage(app);
