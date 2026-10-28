import { getFirestore, doc, setDoc, updateDoc, onSnapshot, getDoc, deleteField, FieldPath, DocumentData } from "firebase/firestore";
import { initializeApp } from "firebase/app";
import firebaseConfig from "../../firebase-applet-config.json";
import { SyncDiff, SyncSnapshot } from "./sync";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// 나만 쓰는 앱 - 고정 ID 사용 (로그인 불필요)
const DOC_REF = doc(db, "budgets", "eunbin");

// Firestore는 undefined 값을 거부한다(필드 하나라도 undefined면 setDoc 전체 실패).
// 직렬화 한 번으로 undefined 필드를 안전하게 제거한다.
const stripUndefined = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const toSnapshot = (data: DocumentData): SyncSnapshot => ({
  months: data.months || [],
  budgetState: data.budgetState || {},
  fixedDefaults: data.fixedDefaults,
});

/**
 * 바뀐 부분만 저장한다. 다른 달은 건드리지 않으므로, 다른 기기에서 고친 달을 덮어쓰지 않는다.
 * 문서가 아직 없으면(isNewDoc) 전체를 처음 한 번 만든다.
 */
export const saveChanges = async (diff: SyncDiff, isNewDoc: boolean, full: SyncSnapshot): Promise<void> => {
  const updatedAt = new Date().toISOString();
  if (isNewDoc) {
    await setDoc(DOC_REF, { ...stripUndefined(full), updatedAt });
    return;
  }
  // 달 키("2026-10")에 '-'가 있어 점 표기 대신 FieldPath로 지정한다. 한 번의 updateDoc이라 전부 저장되거나 전부 실패한다.
  const fields: unknown[] = [];
  for (const [key, md] of Object.entries(diff.changedMonths)) fields.push(new FieldPath("budgetState", key), stripUndefined(md));
  for (const key of diff.deletedMonths) fields.push(new FieldPath("budgetState", key), deleteField());
  if (diff.months) fields.push("months", diff.months);
  if (diff.fixedDefaults) fields.push("fixedDefaults", stripUndefined(diff.fixedDefaults));
  // @ts-ignore — updateDoc(ref, field, value, ...moreFieldsAndValues) 가변 인자 형태
  await updateDoc(DOC_REF, "updatedAt", updatedAt, ...fields);
};

/** 문서가 없으면 null */
export const loadFromFirestore = async (): Promise<SyncSnapshot | null> => {
  const snap = await getDoc(DOC_REF);
  return snap.exists() ? toSnapshot(snap.data()) : null;
};

export const subscribeToFirestore = (
    onData: (snapshot: SyncSnapshot | null) => void
): (() => void) => {
  return onSnapshot(DOC_REF, (snap) => {
    onData(snap.exists() ? toSnapshot(snap.data()) : null);
  });
};
