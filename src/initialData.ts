import { BudgetState, MonthData } from "./types";
import { CYCLE_VERSION, FIXED_LIVING_BUDGET, FIXED_LIVING_CYCLES, isFixedLivingMonth, makeCycles, normalizeFixedLivingAccounts } from "./utils/budgetCalculator";

export const makeDefaultMonth = (year: number, month: number, budget = 600000, totalBudget?: number): MonthData => {
  const ys = String(year);
  const ms = String(month).padStart(2, "0");
  const fixedLiving = isFixedLivingMonth(`${ys}-${ms}`);
  if (fixedLiving) budget = FIXED_LIVING_BUDGET;
  const monthKey = `${ys}-${ms}`;

  const md: MonthData = {
    budget,
    totalBudget,
    fixedBudget: 500000,
    eventBudget: 200000,
    totalSavings: 0,
    memo: "",
    accounts: [
      { name: "청년미래적금", amount: 500000, checked: false },
      { name: "굴비적금", amount: 300000, checked: false },
      { name: "네이버적금", amount: 100000, checked: false },
      { name: "청약", amount: 100000, checked: false },
      { name: "미래에셋ETF", amount: 500000, checked: false },
      { name: "고정지출", amount: 500000, checked: false },
      { name: "경조사비", amount: 200000, checked: false },
      { name: "생활비", amount: 0, checked: false },
    ],
    fixed: [
      { name: "교통비", amount: 56770, day: "매달 15" },
      { name: "통신비", amount: 82410, day: "매달 25" },
      { name: "유튜브프리미엄", amount: 13900, day: "매달 27" },
    ],
    events: [],
    // 생활비 고정 방식 달은 4주기, 그 전은 3주기
    cycles: makeCycles(monthKey, budget, fixedLiving ? FIXED_LIVING_CYCLES : 3),
    expenses: [],
    ...(fixedLiving ? { cycleVersion: CYCLE_VERSION } : {}),
  };
  return normalizeFixedLivingAccounts(monthKey, md);
};

export const initialBudgetState: BudgetState = {};