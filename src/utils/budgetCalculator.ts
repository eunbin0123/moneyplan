import { BudgetState, MonthData, BudgetCycle, ExpenseItem, InstallmentItem, DebtItem } from "../types";

export interface CalculatedCycle extends BudgetCycle {
  baseBudget: number;
  incomeAmount: number;
  carryIn: number;
  effectiveBudget: number;
  spent: number;
  remaining: number;
  carryOut: number;
}

export interface CalculatedMonth extends MonthData {
  carryFromPrevMonth: number;
  effectiveMonthlyBudget: number;
  calculatedCycles: CalculatedCycle[];
  totalLivingSpent: number;
  remainingLiving: number;
  totalFixedSpent: number;
  remainingFixed: number;
  totalEventSpent: number;
  remainingEvent: number;
  totalCombinedBudget: number;
  totalCombinedSpent: number;
  totalCombinedRemaining: number;
  fixedLiving: boolean;       // 생활비 고정 방식 적용 달 여부
  baseEmergency: number;      // 월급 분배 후 남은 비상금 (자동 배정분)
  livingLeftover: number;     // 생활비 잔액 (비상금 전환 대상)
  livingSettled: boolean;     // 월말이 지나 생활비 잔액이 비상금으로 전환되었는지
  fixedLeftover: number;      // 고정지출 통장 배정액 - 실제 고정지출 (초과 시 음수)
  eventLeftover: number;      // 경조사비 통장 배정액 - 실제 경조사비 (초과 시 음수)
  emergencyTotal: number;     // 비상금 통계 = 기본 비상금 + 고정지출/경조사비 잔액 + (월말 이후) 생활비 잔액
}

// 이 달부터 생활비를 고정 금액으로 잡고, 월급의 남은 금액은 비상금으로 자동 배정한다.
export const FIXED_LIVING_FROM = "2026-10";
export const FIXED_LIVING_BUDGET = 390000; // 3주기 × 130,000원
export const LIVING_ACCOUNT_NAME = "생활비";
export const EMERGENCY_ACCOUNT_NAME = "비상금";
export const FIXED_ACCOUNT_NAME = "고정지출";
export const EVENT_ACCOUNT_NAME = "경조사비";

// 생활비 고정 방식 달의 기본 통장별 이체 분배 (비상금은 자동 계산)
export const DISTRIBUTION_VERSION = 1;
export const DEFAULT_FIXED_LIVING_ACCOUNTS: { name: string; amount: number }[] = [
  { name: "청년미래적금", amount: 500000 },
  { name: "굴비적금", amount: 300000 },
  { name: "청약", amount: 100000 },
  { name: "미래에셋ETF", amount: 400000 },
  { name: FIXED_ACCOUNT_NAME, amount: 300000 },
  { name: EVENT_ACCOUNT_NAME, amount: 200000 },
  { name: "생활비", amount: FIXED_LIVING_BUDGET },
  { name: "비상금", amount: 0 },
];

export const isFixedLivingMonth = (monthKey: string) => monthKey >= FIXED_LIVING_FROM;

// 고정 방식 달의 분배 통장 구조를 [...기타, 생활비(390,000 고정), 비상금(자동, 마지막)]으로 맞춘다.
export function normalizeFixedLivingAccounts(monthKey: string, md: MonthData): MonthData {
  if (!isFixedLivingMonth(monthKey)) return md;
  // 기본 분배 규칙을 아직 적용하지 않은 달은 한 번 덮어쓴다 (이체 완료 체크는 이름 기준으로 유지)
  if ((md.distributionVersion ?? 0) < DISTRIBUTION_VERSION) {
    const prev = md.accounts || [];
    md = {
      ...md,
      distributionVersion: DISTRIBUTION_VERSION,
      accounts: DEFAULT_FIXED_LIVING_ACCOUNTS.map(a => ({
        ...a,
        checked: prev.find(p => p.name === a.name)?.checked ?? false,
      })),
    };
  }
  const accounts = md.accounts || [];
  const last = accounts[accounts.length - 1];
  const living = accounts.find(a => a.name === LIVING_ACCOUNT_NAME);
  const emergency = accounts.find(a => a.name === EMERGENCY_ACCOUNT_NAME);
  const alreadyNormalized =
      last?.name === EMERGENCY_ACCOUNT_NAME &&
      accounts[accounts.length - 2]?.name === LIVING_ACCOUNT_NAME &&
      accounts[accounts.length - 2].amount === FIXED_LIVING_BUDGET;
  if (alreadyNormalized) return md;
  const others = accounts.filter(a => a.name !== LIVING_ACCOUNT_NAME && a.name !== EMERGENCY_ACCOUNT_NAME);
  return {
    ...md,
    accounts: [
      ...others,
      { name: LIVING_ACCOUNT_NAME, amount: FIXED_LIVING_BUDGET, checked: living?.checked ?? false },
      { name: EMERGENCY_ACCOUNT_NAME, amount: 0, checked: emergency?.checked ?? false },
    ],
  };
}

export function normalizeBudgetState(state: BudgetState): BudgetState {
  let changed = false;
  const copy: BudgetState = { ...state };
  for (const m of Object.keys(copy)) {
    const next = normalizeFixedLivingAccounts(m, copy[m]);
    if (next !== copy[m]) { copy[m] = next; changed = true; }
  }
  return changed ? copy : state;
}

// 고정 방식 달의 실사용 생활비: 당겨쓰기는 생활비 390,000원 안에서 갚는다
export const calcFixedLivingBudget = (debtCharge: number) => Math.max(0, FIXED_LIVING_BUDGET - debtCharge);

// 월급 분배에서 자동 계산되는 마지막 통장 금액
// - 기존 방식: 생활비 = 월급 - 나머지 항목 - 할부 - 당겨쓰기
// - 고정 방식: 비상금 = 월급 - 생활비(390,000, 당겨쓰기 포함) - 나머지 항목 - 할부
export function calcAutoAccountAmount(monthKey: string, md: MonthData, installmentCharge: number, debtCharge: number): number {
  const accounts = md.accounts || [];
  const salary = md.salary ?? 0;
  if (salary <= 0) return accounts[accounts.length - 1]?.amount ?? 0;
  const fixedAccountsTotal = accounts.slice(0, -1).reduce((sum, a) => sum + a.amount, 0);
  const debtFromSalary = isFixedLivingMonth(monthKey) ? 0 : debtCharge;
  return Math.max(0, salary - fixedAccountsTotal - installmentCharge - debtFromSalary);
}

const localDateStr = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function calcInstallmentForMonth(
    monthKey: string,
    allInstallments: InstallmentItem[]
): number {
  const monthIdx = (key: string) => {
    const [y, mo] = key.split("-").map(Number);
    return y * 12 + (mo - 1);
  };
  const cur = monthIdx(monthKey);
  return allInstallments.reduce((sum, it) => {
    const start = monthIdx(it.startMonth);
    if (cur < start || cur >= start + it.months) return sum;
    const amount = (it.overrides && it.overrides[monthKey] !== undefined) ? it.overrides[monthKey] : it.monthlyAmount;
    return sum + amount;
  }, 0);
}

export function calculateBudgetWithCarryOver(
    months: string[],
    budgetState: BudgetState,
    allInstallments?: InstallmentItem[]
): Record<string, CalculatedMonth> {
  const sortedMonths = [...months].sort();
  const computedState: Record<string, CalculatedMonth> = {};
  let runningCarryOver = 0;

  const installmentList: InstallmentItem[] = allInstallments ?? (() => {
    const list: InstallmentItem[] = [];
    Object.values(budgetState).forEach((md) => {
      (md.installments || []).forEach((it) => list.push(it));
    });
    return list;
  })();

  for (const m of sortedMonths) {
    const rawData = budgetState[m];
    if (!rawData) continue;

    const fixedLiving = isFixedLivingMonth(m);
    // 고정 방식 달은 생활비 잔액을 다음 달로 이월하지 않는다.
    const carryFromPrevMonth = fixedLiving ? 0 : runningCarryOver;
    let workingCycles = rawData.cycles ? rawData.cycles.map(c => ({ ...c })) : [];

    // salary 기반 순수 생활비 계산
    const salary = rawData.salary ?? 0;
    const installmentCharge = calcInstallmentForMonth(m, installmentList);
    const debtCharge = (rawData.debts || []).reduce((sum, d) => sum + d.amount, 0);
    const autoAccountAmount = calcAutoAccountAmount(m, rawData, installmentCharge, debtCharge);
    const baseLivingBudget = fixedLiving
        ? calcFixedLivingBudget(debtCharge)
        : salary > 0
            ? autoAccountAmount
            : Math.max(0, workingCycles.reduce((sum, c) => sum + (c.budget || 0), 0) - debtCharge);
    const baseEmergency = fixedLiving && salary > 0 ? autoAccountAmount : 0;

    // 주기 예산 분배: baseLivingBudget을 주기 수로 균등 분배
    // manual=true인 주기는 저장값 유지, 나머지만 균등 분배
    // salary=0(수동 주기예산) 모드에서도 당겨쓰기(debtCharge)가 있으면 그만큼 차감 분배
    if (workingCycles.length > 0 && (fixedLiving || salary > 0 || debtCharge > 0)) {
      const pinnedSum = workingCycles.reduce((s, c) => s + (c.manual ? (c.budget || 0) : 0), 0);
      const autoCount = workingCycles.filter(c => !c.manual).length;
      const autoTotal = Math.max(0, baseLivingBudget - pinnedSum);
      const base = autoCount > 0 ? Math.floor(autoTotal / autoCount) : 0;
      const rem = autoCount > 0 ? autoTotal - base * autoCount : 0;
      let autoSeen = 0;
      workingCycles = workingCycles.map(c => {
        if (c.manual) return { ...c };
        autoSeen += 1;
        return { ...c, budget: autoSeen === autoCount ? base + rem : base };
      });
    }

    const baseMonthlyBudget = workingCycles.reduce((sum, c) => sum + (c.budget || 0), 0);
    const totalIncome = (rawData.incomes || []).reduce((sum, inc) => sum + inc.amount, 0);
    const effectiveMonthlyBudget = baseMonthlyBudget + carryFromPrevMonth + totalIncome;

    const calculatedCycles: CalculatedCycle[] = workingCycles.map((c, ci) => {
      const spent = (rawData.expenses || [])
          .filter((e) => e.date >= c.start && e.date <= c.end && e.checked !== false)
          .reduce((sum, item) => sum + (item.amount - (item.settleAmount || 0)), 0);
      const incomeAmount = (rawData.incomes || [])
          .filter((inc) => inc.cycleIdx === ci)
          .reduce((sum, inc) => sum + inc.amount, 0);
      return {
        ...c,
        baseBudget: c.budget,
        incomeAmount,
        carryIn: 0,
        effectiveBudget: c.budget + incomeAmount,
        spent,
        remaining: c.budget + incomeAmount - spent,
        carryOut: 0,
      };
    });

    // 주기간 이월 계산
    for (let i = 0; i < calculatedCycles.length; i++) {
      const cycle = calculatedCycles[i];
      cycle.carryIn = i === 0 ? carryFromPrevMonth : calculatedCycles[i - 1].carryOut;
      cycle.effectiveBudget = cycle.baseBudget + cycle.incomeAmount + cycle.carryIn;
      cycle.remaining = cycle.effectiveBudget - cycle.spent;
      cycle.carryOut = Math.max(0, cycle.remaining);
    }

    const updatedCyclesForCompat = calculatedCycles.map((cc) => ({
      ...cc,
      budget: cc.baseBudget,
    }));

    const totalLivingSpent = (rawData.expenses || [])
        .filter((e) => e.checked !== false)
        .reduce((sum, item) => sum + (item.amount - (item.settleAmount || 0)), 0);

    // runningCarryOver: effectiveMonthlyBudget 기준 (수입/이월 모두 포함)
    const remainingLiving = effectiveMonthlyBudget - totalLivingSpent;
    runningCarryOver = Math.max(0, remainingLiving);

    // 고정 방식: 월말(마지막 주기 종료)이 지나면 생활비 잔액을 그 달 비상금으로 전환
    const livingLeftover = fixedLiving ? Math.max(0, remainingLiving) : 0;
    const lastCycleEnd = workingCycles.reduce((max, c) => (c.end > max ? c.end : max), "");
    const livingSettled = fixedLiving && lastCycleEnd !== "" && localDateStr() > lastCycleEnd;

    const fixedAllocBudget = rawData.fixedBudget ?? 500000;
    const totalFixedSpent = (rawData.fixed || []).reduce((sum, item) => sum + item.amount, 0);
    const remainingFixed = fixedAllocBudget - totalFixedSpent;

    const eventAllocBudget = rawData.eventBudget ?? 200000;
    const totalEventSpent = (rawData.events || []).reduce((sum, item) => sum + item.amount, 0);
    const remainingEvent = eventAllocBudget - totalEventSpent;

    // 고정 방식: 고정지출/경조사비 통장에서 쓰고 남은 돈(초과 시 차감)도 그 달 비상금으로
    const accountAmount = (name: string) =>
        (rawData.accounts || []).filter(a => a.name === name).reduce((sum, a) => sum + a.amount, 0);
    const fixedLeftover = fixedLiving ? accountAmount(FIXED_ACCOUNT_NAME) - totalFixedSpent : 0;
    const eventLeftover = fixedLiving ? accountAmount(EVENT_ACCOUNT_NAME) - totalEventSpent : 0;
    const emergencyTotal = baseEmergency + fixedLeftover + eventLeftover + (livingSettled ? livingLeftover : 0);

    const totalCombinedBudget = effectiveMonthlyBudget + fixedAllocBudget + eventAllocBudget;
    const totalCombinedSpent = totalLivingSpent + totalFixedSpent + totalEventSpent;
    const totalCombinedRemaining = totalCombinedBudget - totalCombinedSpent;

    computedState[m] = {
      ...rawData,
      budget: baseMonthlyBudget,
      cycles: updatedCyclesForCompat,
      carryFromPrevMonth,
      effectiveMonthlyBudget,
      calculatedCycles,
      totalLivingSpent,
      remainingLiving,
      totalFixedSpent,
      remainingFixed,
      totalEventSpent,
      remainingEvent,
      totalCombinedBudget,
      totalCombinedSpent,
      totalCombinedRemaining,
      fixedLiving,
      baseEmergency,
      livingLeftover,
      fixedLeftover,
      eventLeftover,
      livingSettled,
      emergencyTotal,
    };
  }

  return computedState;
}