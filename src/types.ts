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

export interface IncomeItem {
  id: string;
  name: string;
  amount: number;
  cycleIdx: number; // 어느 주기에 넣을지
}

export interface InstallmentItem {
  id: string;
  name: string;
  startMonth: string;   // "YYYY-MM" 시작 월
  months: number;       // 할부 개월 수
  totalAmount: number;  // 총 결제 금액
  monthlyAmount: number; // 월 납부액 (기본 = 총액/개월, 수정 가능)
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
  incomes?: IncomeItem[];
  installments?: InstallmentItem[];   // 이 달에 등록한 할부 목록
  carryFromPrevMonth?: number;      // 이월 금액
  effectiveMonthlyBudget?: number;  // 이월금이 반영된 정산 생활비 예산
}

export type BudgetState = Record<string, MonthData>;