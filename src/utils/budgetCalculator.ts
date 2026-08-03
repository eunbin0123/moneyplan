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
}

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

    const carryFromPrevMonth = runningCarryOver;
    let workingCycles = rawData.cycles ? rawData.cycles.map(c => ({ ...c })) : [];

    // salary 기반 순수 생활비 계산
    const salary = rawData.salary ?? 0;
    const fixedAccountsTotal = (rawData.accounts || [])
        .slice(0, -1)
        .reduce((sum, a) => sum + a.amount, 0);
    const installmentCharge = calcInstallmentForMonth(m, installmentList);
    const debtCharge = (rawData.debts || []).reduce((sum, d) => sum + d.amount, 0);
    const baseLivingBudget = salary > 0
        ? Math.max(0, salary - fixedAccountsTotal - installmentCharge - debtCharge)
        : workingCycles.reduce((sum, c) => sum + (c.budget || 0), 0);

    // 주기 예산 분배: baseLivingBudget을 주기 수로 균등 분배
    // manual=true인 주기는 저장값 유지, 나머지만 균등 분배
    if (salary > 0 && workingCycles.length > 0) {
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

    const fixedAllocBudget = rawData.fixedBudget ?? 500000;
    const totalFixedSpent = (rawData.fixed || []).reduce((sum, item) => sum + item.amount, 0);
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