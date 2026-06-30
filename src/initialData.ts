import { BudgetState, MonthData } from "./types";

export const makeDefaultMonth = (year: number, month: number, budget = 600000, totalBudget?: number): MonthData => {
  const ys = String(year);
  const ms = String(month).padStart(2, "0");
  const pm = month <= 1 ? 12 : month - 1;
  const py = month <= 1 ? year - 1 : year;
  const pms = String(pm).padStart(2, "0");
  const pys = String(py);
  const lastDay = new Date(year, month, 0).getDate();
  const cb = Math.floor(budget / 3);

  // 1주기: 전달 말일 ~ 9일
  // 2주기: 10일 ~ 19일
  // 3주기: 20일 ~ 이번달 말일 전날
  const prevLastDay = new Date(year, month - 1, 0).getDate();
  const cycleStart = `${pys}-${pms}-${String(prevLastDay).padStart(2, "0")}`;
  const cycleEnd3 = String(lastDay - 1).padStart(2, "0");

  return {
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
    cycles: [
      { label: "1주기", start: cycleStart, end: `${ys}-${ms}-09`, budget: cb },
      { label: "2주기", start: `${ys}-${ms}-10`, end: `${ys}-${ms}-19`, budget: cb },
      { label: "3주기", start: `${ys}-${ms}-20`, end: `${ys}-${ms}-${cycleEnd3}`, budget: budget - cb * 2 },
    ],
    expenses: [],
  };
};

export const initialBudgetState: BudgetState = {};