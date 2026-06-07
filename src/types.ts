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
  baseBudget?: number;
  carryIn?: number;
  carryOut?: number;
  manual?: boolean;   // ← 추가: true면 자동분배에서 제외(이 값 고정)
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

export interface DebtItem {
  id: string;
  name: string;        // 메모 (예: "5월 초과분", "친구한테 빌림")
  amount: number;      // 갚아야 할 금액
  fromMonth: string;   // "YYYY-MM" 발생 월
  targetMonth: string; // "YYYY-MM" 이 달에 차감 적용할 월
}

export interface MonthData {
  budget: number;
  totalBudget?: number;       // 총 지출 한도 (생활비+고정+경조사+할부를 모두 포함한 전체 예산)
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
  debts?: DebtItem[];                  // 당겨쓰기(부채) 목록
  carryFromPrevMonth?: number;      // 이월 금액
  effectiveMonthlyBudget?: number;  // 이월금이 반영된 정산 생활비 예산
}

export type BudgetState = Record<string, MonthData>;