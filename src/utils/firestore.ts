import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import firebaseConfig from "../../firebase-applet-config.json";
import { BudgetState, FixedExpense } from "../types";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 나만 쓰는 앱 - 고정 ID 사용 (로그인 불필요)
const DOC_REF = doc(db, "budgets", "eunbin");

// Firestore는 undefined 값을 거부한다(필드 하나라도 undefined면 setDoc 전체 실패).
// 직렬화 한 번으로 undefined 필드를 안전하게 제거한다.
const stripUndefined = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export const saveToFirestore = async (
    months: string[],
    budgetState: BudgetState,
    fixedDefaults: FixedExpense[]
): Promise<void> => {
  await setDoc(DOC_REF, {
    months,
    budgetState: stripUndefined(budgetState),
    fixedDefaults: stripUndefined(fixedDefaults),
    updatedAt: new Date().toISOString(),
  });
};

export const loadFromFirestore = async (): Promise<{
  months: string[];
  budgetState: BudgetState;
  fixedDefaults?: FixedExpense[];
} | null> => {
  const snap = await getDoc(DOC_REF);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    months: data.months || [],
    budgetState: data.budgetState || {},
    fixedDefaults: data.fixedDefaults,
  };
};

export const subscribeToFirestore = (
    onData: (months: string[], budgetState: BudgetState, fixedDefaults?: FixedExpense[]) => void
): (() => void) => {
  return onSnapshot(DOC_REF, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.months && data.budgetState) {
      onData(data.months, data.budgetState, data.fixedDefaults);
    }
  });
};