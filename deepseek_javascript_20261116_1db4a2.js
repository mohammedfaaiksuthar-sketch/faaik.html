import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDTRn97V1UXVEB3hfb2zyUjIPtF0sFGzN4",
  authDomain: "backcode-c4530.firebaseapp.com",
  databaseURL: "https://backcode-c4530-default-rtdb.firebaseio.com",
  projectId: "backcode-c4530",
  storageBucket: "backcode-c4530.firebasestorage.app",
  messagingSenderId: "909161244968",
  appId: "1:909161244968:web:d4a6fcc6d937b3aba7481d",
  measurementId: "G-L1YDN4N42T"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);