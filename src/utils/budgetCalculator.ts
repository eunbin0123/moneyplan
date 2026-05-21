import { BudgetState, MonthData, BudgetCycle, ExpenseItem } from "../types";

export interface CalculatedCycle extends BudgetCycle {
  baseBudget: number;      // Original assigned budget for this cycle
  carryIn: number;         // Came from previous cycle (or previous month's Cycle 3)
  effectiveBudget: number; // baseBudget + carryIn
  spent: number;           // Actual spend during this cycle's date range
  remaining: number;       // effectiveBudget - spent
  carryOut: number;        // Math.max(0, remaining) to carry over
}

export interface CalculatedMonth extends MonthData {
  carryFromPrevMonth: number;
  effectiveMonthlyBudget: number; // base budget + previous month's leftover
  calculatedCycles: CalculatedCycle[];
  totalLivingSpent: number;
  remainingLiving: number;       // effectiveMonthlyBudget - totalLivingSpent
  totalFixedSpent: number;
  remainingFixed: number;
  totalEventSpent: number;
  remainingEvent: number;
  
  totalCombinedBudget: number;
  totalCombinedSpent: number;
  totalCombinedRemaining: number;
}

/**
 * Calculations for carry-over sequence:
 * 1. Sort months chronologically (keys represent YYYY-MM, e.g., "2025-05").
 * 2. Maintain a running `carryFromPrevMonth` initialized to 0.
 * 3. Inside each month:
 *    - The month starts with `carryFromPrevMonth` from the previous month.
 *    - This carry-over boosts the first cycle's budget:
 *      Cycle 1: effectiveBudget = c1.budget + carryFromPrevMonth.
 *    - Expenses fall into cycles according to activeDate boundary checks.
 *    - Positive remaining budget of Cycle 1 is `carryIn` for Cycle 2.
 *    - Positive remaining budget of Cycle 2 is `carryIn` for Cycle 3.
 *    - Positive remaining budget of Cycle 3 (or the overall remaining net living budget) is carried forward to the next month.
 */
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
    const baseMonthlyBudget = (rawData.cycles || []).reduce((sum, c) => sum + (c.budget || 0), 0);
    const effectiveMonthlyBudget = baseMonthlyBudget + carryFromPrevMonth;

    // First, let's copy cycles and set up basic info
    const calculatedCycles: CalculatedCycle[] = rawData.cycles.map((c) => {
      const spent = rawData.expenses
        .filter((e) => e.date >= c.start && e.date <= c.end && e.checked !== false)
        .reduce((sum, item) => sum + item.amount, 0);

      return {
        ...c,
        baseBudget: c.budget,
        carryIn: 0,
        effectiveBudget: c.budget,
        spent,
        remaining: c.budget - spent,
        carryOut: 0,
      };
    });

    // Run cycle-to-cycle cascading carry-over
    for (let i = 0; i < calculatedCycles.length; i++) {
      const cycle = calculatedCycles[i];
      if (i === 0) {
        cycle.carryIn = carryFromPrevMonth;
      } else {
        cycle.carryIn = calculatedCycles[i - 1].carryOut;
      }
      cycle.effectiveBudget = cycle.baseBudget + cycle.carryIn;
      cycle.remaining = cycle.effectiveBudget - cycle.spent;
      // Negative overruns are not carried to prevent punishing the next cycle's base budget
      cycle.carryOut = Math.max(0, cycle.remaining);
    }

    // Replace the cycle budget values so standard consumers see the effective budget directly
    const updatedCyclesForCompat = calculatedCycles.map((cc) => ({
      ...cc,
      budget: cc.effectiveBudget, // override c.budget with effective budget
    }));

    // Calculate overall categories
    const totalLivingSpent = rawData.expenses
      .filter((e) => e.checked !== false)
      .reduce((sum, item) => sum + item.amount, 0);

    const remainingLiving = effectiveMonthlyBudget - totalLivingSpent;

    // Carry-over for next month: any positive remaining living cash
    runningCarryOver = Math.max(0, remainingLiving);

    // Fixed & Event calculation
    const fixedAllocBudget = rawData.fixedBudget ?? 160000;
    const totalFixedSpent = rawData.fixed.reduce((sum, item) => sum + item.amount, 0);
    const remainingFixed = fixedAllocBudget - totalFixedSpent;

    const eventAllocBudget = rawData.eventBudget ?? 200000;
    const totalEventSpent = (rawData.events || []).reduce((sum, item) => sum + item.amount, 0);
    const remainingEvent = eventAllocBudget - totalEventSpent;

    // Combined totals
    const totalCombinedBudget = effectiveMonthlyBudget + fixedAllocBudget + eventAllocBudget;
    const totalCombinedSpent = totalLivingSpent + totalFixedSpent + totalEventSpent;
    const totalCombinedRemaining = totalCombinedBudget - totalCombinedSpent;

    computedState[m] = {
      ...rawData,
      budget: baseMonthlyBudget, // ensure budget is computed dynamically from the cycles
      cycles: updatedCyclesForCompat, // upgraded compatibility injection
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
