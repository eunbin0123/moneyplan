import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 가계부(budgets/eunbin)와 완전히 분리된 별도 문서
const TRAVEL_REF = doc(db, "travel", "eunbin");

export const saveTravelData = async (data: any): Promise<void> => {
  await setDoc(TRAVEL_REF, { ...data, updatedAt: new Date().toISOString() });
};

export const loadTravelData = async (): Promise<any | null> => {
  const snap = await getDoc(TRAVEL_REF);
  if (!snap.exists()) return null;
  return snap.data();
};

export const subscribeTravelData = (onData: (data: any) => void): (() => void) => {
  return onSnapshot(TRAVEL_REF, (snap) => {
    if (!snap.exists()) return;
    onData(snap.data());
  });
};
