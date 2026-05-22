export interface Account {
  name: string;
  amount: number;
  checked: boolean;
}

export interface FixedExpense {
  name: string;
  amount: number;
  day: string;
}

export interface EventExpense {
  name: string;
  amount: number;
}

export interface BudgetCycle {
  label: string;
  start: string;
  end: string;
  budget: number;
  baseBudget?: number;  // 기본 배정액
  carryIn?: number;     // 이전 단위에서 이월된 금액
  carryOut?: number;    // 다음 단위로 이월하는 금액
}

export interface ExpenseItem {
  id?: string; // custom ID to avoid index bugs
  date: string;
  name: string;
  amount: number;
  editable?: boolean;
  checked?: boolean;
}

export interface MonthData {
  budget: number;
  fixedBudget?: number;
  eventBudget?: number;
  totalSavings: number;
  memo: string;
  accounts: Account[];
  fixed: FixedExpense[];
  events: EventExpense[];
  cycles: BudgetCycle[];
  expenses: ExpenseItem[];
  salary?: number;
  carryFromPrevMonth?: number;      // 이월 금액
  effectiveMonthlyBudget?: number;  // 이월금이 반영된 정산 생활비 예산
}

export type BudgetState = Record<string, MonthData>;