import { BudgetState, MonthData, BudgetCycle, ExpenseItem } from "../types";

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

export function calculateBudgetWithCarryOver(
    months: string[],
    budgetState: BudgetState
): Record<string, CalculatedMonth> {
  const sortedMonths = [...months].sort();
  const computedState: Record<string, CalculatedMonth> = {};
  let runningCarryOver = 0;

  for (const m of sortedMonths) {
    const rawData = budgetState[m];
    if (!rawData) continue;

    const carryFromPrevMonth = runningCarryOver;

    // 기본 예산 = 주기별 budget 합산
    const baseMonthlyBudget = (rawData.cycles || []).reduce((sum, c) => sum + (c.budget || 0), 0);
    // 총 수입
    const totalIncome = (rawData.incomes || []).reduce((sum, inc) => sum + inc.amount, 0);
    // 유효 예산 = 기본 + 이월 + 수입
    const effectiveMonthlyBudget = baseMonthlyBudget + carryFromPrevMonth + totalIncome;

    const calculatedCycles: CalculatedCycle[] = rawData.cycles.map((c, ci) => {
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