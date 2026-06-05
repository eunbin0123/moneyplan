import { BudgetState, MonthData, BudgetCycle, ExpenseItem, InstallmentItem, DebtItem } from "../types";

export interface CalculatedCycle extends BudgetCycle {
  baseBudget: number;      // 원래 배정 예산 (수입 제외)
  incomeAmount: number;    // 해당 주기 추가 수입
  carryIn: number;         // 이전 주기에서 이월된 금액
  effectiveBudget: number; // baseBudget + incomeAmount + carryIn
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
}

/**
 * 이 달에 적용되는 할부 월납부 합계를 계산합니다.
 * allInstallments 가 없으면 rawData 내의 installments 만 사용합니다.
 */
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
    return sum + (cur >= start && cur < start + it.months ? it.monthlyAmount : 0);
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

  // 전체 할부 목록 (파라미터로 받거나 budgetState 에서 수집)
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

    const carryFromPrevMonth = runningCarryOver;

    // ── rawData를 직접 변이하지 않도록 cycles를 로컬 복사본으로 관리 ──
    let workingCycles = rawData.cycles ? rawData.cycles.map(c => ({ ...c })) : [];

    // ── totalBudget 이 설정된 경우: 역산으로 생활비 예산을 결정 ──────────
    // 생활비 = totalBudget - fixedBudget - eventBudget - 이달 할부 합계 - 당겨쓰기
    // 이 값을 주기 수로 균등 분배한다.
    if (rawData.totalBudget && rawData.totalBudget > 0) {
      const fixedAlloc = rawData.fixedBudget ?? 160000;
      const eventAlloc = rawData.eventBudget ?? 200000;
      const installmentCharge = calcInstallmentForMonth(m, installmentList);
      const debtCharge = (rawData.debts || []).reduce((sum, d) => sum + d.amount, 0);
      const derivedLiving = Math.max(0, rawData.totalBudget - fixedAlloc - eventAlloc - installmentCharge - debtCharge);

      // 균등 분배: 나머지는 마지막 주기에 몰아줌
      const cycleCount = workingCycles.length || 3;
      const base = Math.floor(derivedLiving / cycleCount);
      const remainder = derivedLiving - base * cycleCount;

      workingCycles = workingCycles.map((c, ci) => ({
        ...c,
        budget: ci === cycleCount - 1 ? base + remainder : base,
      }));
    }

    // 기본 예산 = 주기별 budget 합산
    const baseMonthlyBudget = workingCycles.reduce((sum, c) => sum + (c.budget || 0), 0);
    // 총 수입
    const totalIncome = (rawData.incomes || []).reduce((sum, inc) => sum + inc.amount, 0);
    // 유효 예산 = 기본 + 이월 + 수입
    const effectiveMonthlyBudget = baseMonthlyBudget + carryFromPrevMonth + totalIncome;

    const calculatedCycles: CalculatedCycle[] = workingCycles.map((c, ci) => {
      const spent = rawData.expenses
          .filter((e) => e.date >= c.start && e.date <= c.end && e.checked !== false)
          .reduce((sum, item) => sum + item.amount, 0);

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
      if (i === 0) {
        cycle.carryIn = carryFromPrevMonth;
      } else {
        cycle.carryIn = calculatedCycles[i - 1].carryOut;
      }
      cycle.effectiveBudget = cycle.baseBudget + cycle.incomeAmount + cycle.carryIn;
      cycle.remaining = cycle.effectiveBudget - cycle.spent;
      cycle.carryOut = Math.max(0, cycle.remaining);
    }

    const updatedCyclesForCompat = calculatedCycles.map((cc) => ({
      ...cc,
      budget: cc.effectiveBudget,
    }));

    const totalLivingSpent = rawData.expenses
        .filter((e) => e.checked !== false)
        .reduce((sum, item) => sum + item.amount, 0);

    const remainingLiving = effectiveMonthlyBudget - totalLivingSpent;
    runningCarryOver = Math.max(0, remainingLiving);

    const fixedAllocBudget = rawData.fixedBudget ?? 160000;
    const totalFixedSpent = rawData.fixed.reduce((sum, item) => sum + item.amount, 0);
    const remainingFixed = fixedAllocBudget - totalFixedSpent;

    const eventAllocBudget = rawData.eventBudget ?? 200000;
    const totalEventSpent = (rawData.events || []).reduce((sum, item) => sum + item.amount, 0);
    const remainingEvent = eventAllocBudget - totalEventSpent;

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
    };
  }

  return computedState;
}