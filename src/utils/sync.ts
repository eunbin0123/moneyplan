import { BudgetState, FixedExpense, MonthData } from "../types";

// Firestore 문서(budgets/eunbin)와 로컬 상태를 비교·병합하는 순수 함수들.
// 저장할 때는 바뀐 달만 보내고, 다른 기기 변경을 받을 때는 아직 저장 안 된 내 변경을 지키기 위해 쓴다.

export interface SyncSnapshot {
  months: string[];
  budgetState: BudgetState;
  fixedDefaults?: FixedExpense[];
}

export interface SyncDiff {
  months?: string[];                       // 달 목록이 바뀌었을 때만
  fixedDefaults?: FixedExpense[];          // 기본값이 바뀌었을 때만
  changedMonths: Record<string, MonthData>;
  deletedMonths: string[];
}

// 키 순서와 undefined 필드를 무시하고 비교한다.
// (Firestore에서 받은 객체는 키 순서가 다르고, 로컬 객체에는 undefined 필드가 남아 있을 수 있다)
const stable = (value: unknown): string =>
    JSON.stringify(value, (_key, v) =>
        v && typeof v === "object" && !Array.isArray(v)
            ? Object.keys(v).sort().reduce<Record<string, unknown>>((acc, k) => { acc[k] = v[k]; return acc; }, {})
            : v
    ) ?? "undefined";

export const isSame = (a: unknown, b: unknown): boolean => stable(a) === stable(b);

/** base(서버에 있는 상태) 대비 local에서 바뀐 부분 */
export const diffState = (base: SyncSnapshot, local: SyncSnapshot): SyncDiff => {
  const changedMonths: Record<string, MonthData> = {};
  for (const [key, md] of Object.entries(local.budgetState)) {
    if (!isSame(md, base.budgetState[key])) changedMonths[key] = md;
  }
  const deletedMonths = Object.keys(base.budgetState).filter((key) => !(key in local.budgetState));
  return {
    changedMonths,
    deletedMonths,
    ...(isSame(local.months, base.months) ? {} : { months: local.months }),
    ...(isSame(local.fixedDefaults, base.fixedDefaults) ? {} : { fixedDefaults: local.fixedDefaults }),
  };
};

export const isEmptyDiff = (diff: SyncDiff): boolean =>
    Object.keys(diff.changedMonths).length === 0 &&
    diff.deletedMonths.length === 0 &&
    diff.months === undefined &&
    diff.fixedDefaults === undefined;

/** 저장이 끝난 뒤의 서버 상태 = base에 diff를 적용한 것 */
export const applyDiff = (base: SyncSnapshot, diff: SyncDiff): SyncSnapshot => {
  const budgetState = { ...base.budgetState, ...diff.changedMonths };
  for (const key of diff.deletedMonths) delete budgetState[key];
  return {
    months: diff.months ?? base.months,
    budgetState,
    fixedDefaults: diff.fixedDefaults ?? base.fixedDefaults,
  };
};

/**
 * 다른 기기의 변경(remote)을 받았을 때 화면에 보여줄 상태.
 * remote를 기준으로 하되, base 이후 내가 고치고 아직 저장 안 한 달은 내 버전을 유지한다.
 */
export const mergeRemote = (base: SyncSnapshot, local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot => {
  const pending = diffState(base, local);

  const budgetState = { ...remote.budgetState, ...pending.changedMonths };
  for (const key of pending.deletedMonths) delete budgetState[key];

  let months = remote.months;
  if (pending.months) {
    const added = local.months.filter((m) => !base.months.includes(m));
    const removed = base.months.filter((m) => !local.months.includes(m));
    months = [...new Set([...remote.months, ...added])].filter((m) => !removed.includes(m)).sort();
  }

  return {
    months,
    budgetState,
    fixedDefaults: pending.fixedDefaults ?? remote.fixedDefaults ?? local.fixedDefaults,
  };
};
