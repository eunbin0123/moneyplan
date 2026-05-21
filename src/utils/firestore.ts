import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { auth } from "./firebaseAuth";
import { BudgetState } from "../types";

export const db = getFirestore();

const getUserDocRef = (uid: string) => doc(db, "budgets", uid);

// 전체 상태를 Firestore에 저장
export const saveToFirestore = async (
  months: string[],
  budgetState: BudgetState
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;

  const ref = getUserDocRef(user.uid);
  await setDoc(ref, {
    months,
    budgetState,
    updatedAt: new Date().toISOString(),
  });
};

// Firestore에서 한 번 불러오기 (로그인 직후 초기화용)
export const loadFromFirestore = async (): Promise<{
  months: string[];
  budgetState: BudgetState;
} | null> => {
  const user = auth.currentUser;
  if (!user) return null;

  const ref = getUserDocRef(user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    months: data.months || [],
    budgetState: data.budgetState || {},
  };
};

// 실시간 리스너 (다른 기기에서 변경 시 자동 반영)
export const subscribeToFirestore = (
  onData: (months: string[], budgetState: BudgetState) => void
): (() => void) => {
  const user = auth.currentUser;
  if (!user) return () => {};

  const ref = getUserDocRef(user.uid);
  const unsubscribe = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.months && data.budgetState) {
      onData(data.months, data.budgetState);
    }
  });

  return unsubscribe;
};
