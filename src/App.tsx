import { useState, useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from "./components/Header";
import { OverviewTab } from "./components/OverviewTab";
import { DashboardTab } from "./components/DashboardTab";
import { ExpensesTab } from "./components/ExpensesTab";
import { SavingsTab } from "./components/SavingsTab";
import { FixedExpense, BudgetCycle, ExpenseItem, MonthData, BudgetState, EventExpense, IncomeItem, InstallmentItem, DebtItem } from "./types";
import { initialBudgetState, makeDefaultMonth } from "./initialData";
import { ExpenseModal, FixedModal, MonthModal, CycleModal, EventModal, IncomeModal, InstallmentModal, DebtModal } from "./components/Modals";
import { calculateBudgetWithCarryOver, calcInstallmentForMonth } from "./utils/budgetCalculator";
import { saveToFirestore, loadFromFirestore, subscribeToFirestore } from "./utils/firestore";
// @ts-ignore
import styles from "./css/App.module.css";
import { Confetti } from "./components/Confetti";
import { isPayday } from "./utils/payday";

// 인증 관련 추가 import (경로가 다를 경우 수정해주세요)
import { signInWithEmailAndPassword, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./utils/firebaseAuth";

type TabType = "overview" | "expenses" | "fixed" | "installment" | "savings" | "dashboard";

export default function App() {
  // --- 인증(Auth) 상태 ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [budgetState, setBudgetState] = useState<BudgetState>(() => {
    try {
      const saved = localStorage.getItem("smart_budget_state_v2");
      return saved ? JSON.parse(saved) : initialBudgetState;
    } catch { return initialBudgetState; }
  });

  const [months, setMonths] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("smart_budget_months_v2");
      if (saved) return JSON.parse(saved);
      return ["2025-05", "2025-06", "2025-07"];
    } catch { return ["2025-05", "2025-06", "2025-07"]; }
  });

  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("smart_budget_months_v2");
      if (saved) {
        const arr: string[] = JSON.parse(saved);
        const today = new Date().toISOString().slice(0, 7);
        return arr.includes(today) ? today : arr[arr.length - 1] || "2025-05";
      }
    } catch {}
    return "2025-05";
  });

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [isMonthNavOpen, setIsMonthNavOpen] = useState(false);
  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);

  const firestoreUnsub = useRef<(() => void) | null>(null);
  const isRemoteUpdate = useRef(false);

  // 인증 상태 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // 이메일/비밀번호 로그인 처리
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("로그인 에러:", error);
      setAuthError("이메일 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  useEffect(() => {
    localStorage.setItem("smart_budget_state_v2", JSON.stringify(budgetState));
  }, [budgetState]);

  useEffect(() => {
    localStorage.setItem("smart_budget_months_v2", JSON.stringify(months));
  }, [months]);

  useEffect(() => {
    // 로그인되지 않았으면 Firestore 저장 안 함
    if (!user) return;

    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    if (isLoading) return;
    const timer = setTimeout(() => {
      saveToFirestore(months, budgetState).catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [budgetState, months, isLoading, user]);

  useEffect(() => {
    // 로그인되지 않았으면 데이터를 불러오지 않음
    if (!user) return;

    const init = async () => {
      try {
        const remote = await loadFromFirestore();
        if (remote && remote.months.length > 0) {
          const { newMonths, newBudgetState } = ensureMonthsUpToThreeAhead(remote.months, remote.budgetState);
          const monthsChanged = newMonths.length !== remote.months.length;
          if (!monthsChanged) isRemoteUpdate.current = true;
          setMonths(newMonths);
          setBudgetState(newBudgetState);
          setCurrentMonth(findCurrentMonth(newMonths));
        } else {
          const { newMonths, newBudgetState } = ensureMonthsUpToThreeAhead(months, budgetState);
          setMonths(newMonths);
          setBudgetState(newBudgetState);
        }
      } catch (e) {
        console.error("Firestore 로드 실패:", e);
        const { newMonths, newBudgetState } = ensureMonthsUpToThreeAhead(months, budgetState);
        setMonths(newMonths);
        setBudgetState(newBudgetState);
      } finally {
        setIsLoading(false);
      }
      firestoreUnsub.current = subscribeToFirestore((remoteMonths, remoteBudget) => {
        const { newMonths, newBudgetState } = ensureMonthsUpToThreeAhead(remoteMonths, remoteBudget);
        const monthsChanged = newMonths.length !== remoteMonths.length;
        if (!monthsChanged) isRemoteUpdate.current = true;
        setMonths(newMonths);
        setBudgetState(newBudgetState);
      });
    };
    init();
    return () => { if (firestoreUnsub.current) firestoreUnsub.current(); };
  }, [user]);

  const findCurrentMonth = (monthList: string[]) => {
    const now = new Date();
    // 오늘이 월급날이면 다음 달로
    if (isPayday(now)) {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
      if (monthList.includes(nextKey)) return nextKey;
    }
    const today = now.toISOString().slice(0, 7);
    if (monthList.includes(today)) return today;
    return monthList[monthList.length - 1];
  };

  const computedState = calculateBudgetWithCarryOver(months, budgetState);
  const activeData: MonthData = computedState[currentMonth] || budgetState[currentMonth] || makeDefaultMonth(2025, 5);

  const allInstallments: InstallmentItem[] = [];
  Object.values(budgetState).forEach((md) => {
    (md.installments || []).forEach((it) => allInstallments.push(it));
  });

  const currentMonthDebts: DebtItem[] = [];
  Object.values(budgetState).forEach((md) => {
    (md.debts || []).forEach((d) => {
      if (d.targetMonth === currentMonth) currentMonthDebts.push(d);
    });
  });

  // 모달 상태
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseIdx, setEditingExpenseIdx] = useState<number | null>(null);
  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false);
  const [editingFixedIdx, setEditingFixedIdx] = useState<number | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [editingCycleIdx, setEditingCycleIdx] = useState<number | null>(null);
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [editingInstallmentId, setEditingInstallmentId] = useState<string | null>(null);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [memoSavingFeedback, setMemoSavingFeedback] = useState(false);
  const memoFeedbackTimer = useRef<NodeJS.Timeout | null>(null);

  const memoStates: Record<string, boolean> = {};
  months.forEach((m) => {
    const d = budgetState[m];
    memoStates[m] = !!(d && d.memo && d.memo.trim());
  });

  const getShortMonthLabel = (key: string) => {
    const [, month] = key.split("-");
    return `${parseInt(month, 10)}월`;
  };

  const handleToggleAccount = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      mD.accounts = mD.accounts.map((acc, i) => i === idx ? { ...acc, checked: !acc.checked } : acc);
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleSaveExpense = (item: ExpenseItem) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const exps = [...mD.expenses];
      if (editingExpenseIdx !== null && editingExpenseIdx >= 0) { exps[editingExpenseIdx] = item; }
      else { exps.push(item); }
      mD.expenses = exps;
      copy[currentMonth] = mD;
      return copy;
    });
    setEditingExpenseIdx(null);
  };

  const handleDeleteExpense = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const exps = [...mD.expenses];
      exps.splice(idx, 1);
      mD.expenses = exps;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleCycleExpenseStatus = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const exps = [...mD.expenses];
      const cur = exps[idx];
      const reflected = cur.checked !== false;
      const paid = cur.paid === true;
      let next;
      if (!reflected) {
        next = { ...cur, checked: true, paid: false };
      } else if (!paid) {
        next = { ...cur, checked: true, paid: true };
      } else {
        next = { ...cur, checked: false, paid: false };
      }
      exps[idx] = next;
      mD.expenses = exps;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleReorderExpense = (fromIdx: number, toIdx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const exps = [...mD.expenses];
      const [moved] = exps.splice(fromIdx, 1);
      exps.splice(toIdx, 0, moved);
      mD.expenses = exps;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleUpdateExpenseDate = (idx: number, date: string) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const exps = [...(mD.expenses || [])];
      exps[idx] = { ...exps[idx], date };
      mD.expenses = exps;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleSaveFixed = (item: FixedExpense) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      if (editingFixedIdx !== null) {
        const updated = [...mD.fixed];
        updated[editingFixedIdx] = item;
        mD.fixed = updated;
      } else {
        mD.fixed = [...mD.fixed, item];
      }
      copy[currentMonth] = mD;
      return copy;
    });
    setEditingFixedIdx(null);
  };

  const handleDeleteFixed = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const fixed = [...mD.fixed];
      fixed.splice(idx, 1);
      mD.fixed = fixed;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleSaveEvent = (item: EventExpense) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      mD.events = [...(mD.events || []), item];
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleDeleteEvent = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const events = [...(mD.events || [])];
      events.splice(idx, 1);
      mD.events = events;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleSaveIncome = (item: IncomeItem) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const incomes = [...(mD.incomes || [])];
      const existingIdx = incomes.findIndex((i) => i.id === item.id);
      if (existingIdx >= 0) { incomes[existingIdx] = item; }
      else { incomes.push(item); }
      mD.incomes = incomes;
      copy[currentMonth] = mD;
      return copy;
    });
    setEditingIncomeId(null);
  };

  const handleDeleteIncome = (id: string) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      mD.incomes = (mD.incomes || []).filter((i) => i.id !== id);
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleUpdateAllocations = (budget: number, fixedBudget: number, eventBudget: number, totalBudget?: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth], budget, fixedBudget, eventBudget, totalBudget };
      if (totalBudget && totalBudget > 0) {
        mD.cycles = mD.cycles.map((c) => ({ ...c, manual: false }));
      }
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleUpdateMemo = (newMemo: string) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      copy[currentMonth] = { ...copy[currentMonth], memo: newMemo };
      return copy;
    });
    setMemoSavingFeedback(true);
    if (memoFeedbackTimer.current) clearTimeout(memoFeedbackTimer.current);
    memoFeedbackTimer.current = setTimeout(() => setMemoSavingFeedback(false), 1200);
  };

  const handleUpdateSalary = (amount: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = copy[currentMonth];
      if (!mD) return prev;
      copy[currentMonth] = { ...mD, salary: amount };
      return copy;
    });
  };

  const handleSaveInstallment = (item: InstallmentItem) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      let owner: string | null = null;
      for (const mk of Object.keys(copy)) {
        if ((copy[mk].installments || []).some((i) => i.id === item.id)) { owner = mk; break; }
      }
      const target = owner || currentMonth;
      const mD = { ...copy[target] };
      const list = [...(mD.installments || [])];
      const idx = list.findIndex((i) => i.id === item.id);
      if (idx >= 0) list[idx] = item; else list.push(item);
      mD.installments = list;
      copy[target] = mD;
      return copy;
    });
    setEditingInstallmentId(null);
  };

  const handleDeleteInstallment = (id: string) => {
    if (!window.confirm("이 할부를 삭제하시겠습니까?")) return;
    setBudgetState((prev) => {
      const copy = { ...prev };
      for (const mk of Object.keys(copy)) {
        if ((copy[mk].installments || []).some((i) => i.id === id)) {
          copy[mk] = { ...copy[mk], installments: (copy[mk].installments || []).filter((i) => i.id !== id) };
          break;
        }
      }
      return copy;
    });
  };

  const handleSaveDebt = (item: DebtItem) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      let owner: string | null = null;
      for (const mk of Object.keys(copy)) {
        if ((copy[mk].debts || []).some((d) => d.id === item.id)) { owner = mk; break; }
      }
      const target = owner || item.targetMonth || currentMonth;
      const mD = { ...copy[target] };
      const list = [...(mD.debts || [])];
      const idx = list.findIndex((d) => d.id === item.id);
      if (idx >= 0) list[idx] = item; else list.push(item);
      mD.debts = list;
      copy[target] = mD;
      return copy;
    });
    setEditingDebtId(null);
  };

  const handleDeleteDebt = (id: string) => {
    if (!window.confirm("이 당겨쓰기 항목을 삭제하시겠습니까?")) return;
    setBudgetState((prev) => {
      const copy = { ...prev };
      for (const mk of Object.keys(copy)) {
        if ((copy[mk].debts || []).some((d) => d.id === id)) {
          copy[mk] = { ...copy[mk], debts: (copy[mk].debts || []).filter((d) => d.id !== id) };
          break;
        }
      }
      return copy;
    });
  };

  const handleUpdateAccount = (idx: number, amount: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const accounts = [...(mD.accounts || [])];
      accounts[idx] = { ...accounts[idx], amount };
      copy[currentMonth] = { ...mD, accounts };
      return copy;
    });
  };

  const handleToggleInstallment = (id: string) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      for (const mk of Object.keys(copy)) {
        const installments = copy[mk].installments || [];
        if (installments.some((it) => it.id === id)) {
          copy[mk] = {
            ...copy[mk],
            installments: installments.map((it) =>
                it.id === id ? { ...it, checked: !it.checked } : it
            ),
          };
          break;
        }
      }
      return copy;
    });
  };

  const handleToggleDebt = (id: string) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      for (const mk of Object.keys(copy)) {
        const debts = copy[mk].debts || [];
        if (debts.some((d) => d.id === id)) {
          copy[mk] = {
            ...copy[mk],
            debts: debts.map((d) =>
                d.id === id ? { ...d, checked: !d.checked } : d
            ),
          };
          break;
        }
      }
      return copy;
    });
  };

  const ensureMonthsUpToThreeAhead = (
      currentMonths: string[],
      currentBudgetState: BudgetState
  ): { newMonths: string[]; newBudgetState: BudgetState } => {
    const today = new Date();
    const requiredKeys: string[] = [];
    for (let i = 0; i <= 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      requiredKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    let newMonths = [...currentMonths];
    let newBudgetState = { ...currentBudgetState };
    let changed = false;
    for (const key of requiredKeys) {
      if (!newMonths.includes(key)) {
        const [y, m] = key.split("-").map(Number);
        newMonths.push(key);
        newBudgetState[key] = makeDefaultMonth(y, m);
        changed = true;
      }
    }
    if (changed) newMonths.sort();
    return { newMonths, newBudgetState };
  };

  const handleSaveMonth = (year: number, month: number, budget: number) => {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (budgetState[key]) { alert("이미 동일한 지출월 데이터가 존재합니다."); return; }
    setBudgetState((prev) => ({ ...prev, [key]: makeDefaultMonth(year, month, budget) }));
    setMonths((prev) => { const next = [...prev, key]; next.sort(); return next; });
    setCurrentMonth(key);
    setActiveTab("overview");
  };

  const handleDeleteMonth = (key: string) => {
    if (months.length <= 1) { alert("최소 1개 이상의 지출월이 필요합니다."); return; }
    if (!window.confirm(`${getShortMonthLabel(key)} 전체 내역을 삭제하시겠습니까?`)) return;
    const idx = months.indexOf(key);
    const newMonths = months.filter((m) => m !== key);
    setMonths(newMonths);
    setBudgetState((prev) => { const copy = { ...prev }; delete copy[key]; return copy; });
    setCurrentMonth(newMonths[Math.max(0, Math.min(idx, newMonths.length - 1))]);
    setActiveTab("overview");
  };

  const handleSaveCycle = (cycle: BudgetCycle) => {
    if (editingCycleIdx === null) return;
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const cycles = [...mD.cycles];
      const isAutoMode = !!(mD.totalBudget && mD.totalBudget > 0);

      // initialCycle이 computedState 기준이므로 cycle.budget은 computedState 값
      // Firestore에도 computedState budget을 sync한 뒤, 사용자가 바꾼 경우만 manual=true
      // activeData.cycles에서 computedState budget 가져오기
      const computedBudget = activeData?.cycles?.[editingCycleIdx]?.budget ?? cycles[editingCycleIdx]?.budget ?? 0;
      const storedManual = cycles[editingCycleIdx]?.manual ?? false;
      const budgetChanged = cycle.budget !== computedBudget;
      cycles[editingCycleIdx] = {
        ...cycle,
        manual: budgetChanged ? true : storedManual,
      };

      mD.cycles = cycles;
      copy[currentMonth] = mD;
      return copy;
    });
    setEditingCycleIdx(null);
  };

  /* ── 렌더 ── */

  // 1. 인증 정보 로드 중 화면
  if (!isAuthReady) {
    return (
        <div className={styles.loadingScreen}>
          <div className={styles.loadingInner}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>인증 정보 확인 중...</p>
          </div>
        </div>
    );
  }

  // 2. 비로그인 시 이메일 로그인 화면
  // 2. 비로그인 시 이메일 로그인 화면
  if (!user) {
    return (
        <div className={styles.loadingScreen}>
          <form
              onSubmit={handleLogin}
              style={{
                backgroundColor: "var(--c-card)", // 카드 배경색 통일
                padding: "2.5rem 2rem",
                borderRadius: "var(--radius-lg)", // 부드러운 모서리
                boxShadow: "var(--shadow-float)", // 떠 있는 듯한 그림자 효과
                display: "flex",
                flexDirection: "column",
                gap: "1.25rem",
                width: "90%",
                maxWidth: "340px",
                margin: "0 1rem"
              }}
          >
            <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
              <h2 style={{
                margin: "0 0 0.5rem 0",
                color: "var(--c-deepgreen)", // 메인 포인트 컬러
                fontSize: "1.5rem",
                fontWeight: "var(--fw-bold)",
                letterSpacing: "-0.02em"
              }}>
                Money Plan
              </h2>
              <p style={{
                margin: 0,
                color: "var(--c-text-muted)",
                fontSize: "var(--fs-sm)"
              }}>
                스마트한 예산 관리를 시작하세요
              </p>
            </div>

            {authError && (
                <p style={{
                  color: "var(--c-red)",
                  fontSize: "var(--fs-sm)",
                  margin: 0,
                  textAlign: "center",
                  backgroundColor: "color-mix(in srgb, var(--c-red) 10%, transparent)",
                  padding: "0.5rem",
                  borderRadius: "var(--radius-pill)"
                }}>
                  {authError}
                </p>
            )}

            <input
                type="email"
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  padding: "1rem 1.25rem",
                  borderRadius: "var(--radius-pill)", // 둥근 입력창
                  border: "1.5px solid var(--c-purplegrey)",
                  backgroundColor: "var(--c-bg-soft)",
                  outline: "none",
                  fontSize: "var(--fs-base)",
                  transition: "border-color 0.2s",
                  color: "var(--c-text)"
                }}
                onFocus={(e) => e.target.style.borderColor = "var(--c-deepgreen)"}
                onBlur={(e) => e.target.style.borderColor = "var(--c-purplegrey)"}
                required
            />

            <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  padding: "1rem 1.25rem",
                  borderRadius: "var(--radius-pill)",
                  border: "1.5px solid var(--c-purplegrey)",
                  backgroundColor: "var(--c-bg-soft)",
                  outline: "none",
                  fontSize: "var(--fs-base)",
                  transition: "border-color 0.2s",
                  color: "var(--c-text)"
                }}
                onFocus={(e) => e.target.style.borderColor = "var(--c-deepgreen)"}
                onBlur={(e) => e.target.style.borderColor = "var(--c-purplegrey)"}
                required
            />

            <button
                type="submit"
                style={{
                  padding: "1.125rem",
                  borderRadius: "var(--radius-pill)",
                  border: "none",
                  backgroundColor: "var(--c-deepgreen)", // 메인 버튼 컬러
                  color: "var(--c-card)",
                  fontWeight: "var(--fw-bold)",
                  cursor: "pointer",
                  fontSize: "var(--fs-base)",
                  marginTop: "0.5rem",
                  boxShadow: "0 4px 12px rgba(42, 58, 43, 0.15)",
                  transition: "background-color 0.2s, transform 0.1s"
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "var(--c-red)"} // 호버 시 포인트 컬러
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "var(--c-deepgreen)"}
                onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
                onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
            >
              로그인
            </button>
          </form>
        </div>
    );
  }

  // 3. 로그인 후 데이터 로드 중 화면
  if (isLoading) {
    return (
        <div className={styles.loadingScreen}>
          <div className={styles.loadingInner}>
            <div className={styles.loadingSpinner} />
            <p className={styles.loadingText}>데이터 불러오는 중...</p>
          </div>
        </div>
    );
  }

  // 4. 메인 앱 화면
  return (
      <div className={styles.root}>
        {isPayday() && <Confetti />}
        <Header
            months={months}
            currentMonth={currentMonth}
            onSelectMonth={setCurrentMonth}
            onDeleteMonth={handleDeleteMonth}
            memoStates={memoStates}
            memo={activeData.memo}
            onUpdateMemo={handleUpdateMemo}
            memoSavingFeedback={memoSavingFeedback}
            shortMonthLabel={getShortMonthLabel(currentMonth)}
            isDark={isDark}
            onToggleDark={() => setIsDark(d => !d)}
            isMemoOpen={isMemoOpen}
            onToggleMemo={() => setIsMemoOpen(prev => !prev)}
            isMonthNavOpen={isMonthNavOpen}
            onToggleMonthNav={() => setIsMonthNavOpen(prev => !prev)}
        />

        <main className={styles.main}>
          <AnimatePresence mode="wait">
            <motion.div
                key={activeTab + "-" + currentMonth}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
            >
              {activeTab === "overview" && (
                  <OverviewTab
                      data={activeData}
                      activeMonth={currentMonth}
                      onEditCycle={(idx) => { setEditingCycleIdx(idx); setIsCycleModalOpen(true); }}
                      onOpenMemo={() => setIsMemoOpen(true)}
                      onOpenSavings={() => setIsSavingsModalOpen(true)}
                      onOpenDashboard={() => setActiveTab("dashboard")}
                      installments={allInstallments}
                      debts={currentMonthDebts}
                      rawCycles={budgetState[currentMonth]?.cycles || []}
                  />
              )}
              {activeTab === "expenses" && (
                  <ExpensesTab
                      data={activeData}
                      onAddExpense={() => { setEditingExpenseIdx(null); setIsExpenseModalOpen(true); }}
                      onEditExpense={(idx) => { setEditingExpenseIdx(idx); setIsExpenseModalOpen(true); }}
                      onDeleteExpense={handleDeleteExpense}
                      onCycleStatus={handleCycleExpenseStatus}
                      onReorderExpense={handleReorderExpense}
                      onUpdateExpenseDate={handleUpdateExpenseDate}
                      allExpenses={Object.values(budgetState).flatMap(md => md.expenses || [])}
                      onAddIncome={() => { setEditingIncomeId(null); setIsIncomeModalOpen(true); }}
                      onEditIncome={(id) => { setEditingIncomeId(id); setIsIncomeModalOpen(true); }}
                      onDeleteIncome={handleDeleteIncome}
                      isMonthNavOpen={isMonthNavOpen}

                  />
              )}
              {activeTab === "fixed" && (
                  <SavingsTab
                      data={activeData}
                      onToggleAccount={handleToggleAccount}
                      onAddFixed={() => { setEditingFixedIdx(null); setIsFixedModalOpen(true); }}
                      onEditFixed={(idx) => { setEditingFixedIdx(idx); setIsFixedModalOpen(true); }}
                      onDeleteFixed={handleDeleteFixed}
                      onAddEvent={() => setIsEventModalOpen(true)}
                      onDeleteEvent={handleDeleteEvent}
                      onUpdateSalary={handleUpdateSalary}
                      activeSubTab="fixed"
                  />
              )}
              {activeTab === "installment" && (
                  <SavingsTab
                      data={activeData}
                      onToggleAccount={handleToggleAccount}
                      onAddFixed={() => { setEditingFixedIdx(null); setIsFixedModalOpen(true); }}
                      onEditFixed={(idx) => { setEditingFixedIdx(idx); setIsFixedModalOpen(true); }}
                      onDeleteFixed={handleDeleteFixed}
                      onAddEvent={() => setIsEventModalOpen(true)}
                      onDeleteEvent={handleDeleteEvent}
                      onUpdateSalary={handleUpdateSalary}
                      activeSubTab="installment"
                      installments={allInstallments}
                      activeMonth={currentMonth}
                      onAddInstallment={() => { setEditingInstallmentId(null); setIsInstallmentModalOpen(true); }}
                      onEditInstallment={(id) => { setEditingInstallmentId(id); setIsInstallmentModalOpen(true); }}
                      onDeleteInstallment={handleDeleteInstallment}
                      debts={currentMonthDebts}
                      onAddDebt={() => { setEditingDebtId(null); setIsDebtModalOpen(true); }}
                      onEditDebt={(id) => { setEditingDebtId(id); setIsDebtModalOpen(true); }}
                      onDeleteDebt={handleDeleteDebt}
                  />
              )}
              {activeTab === "dashboard" && (
                  <DashboardTab
                      budgetState={budgetState}
                      months={months}
                  />
              )}
              {activeTab === "savings" && (
                  <SavingsTab
                      data={activeData}
                      onToggleAccount={handleToggleAccount}
                      onAddFixed={() => { setEditingFixedIdx(null); setIsFixedModalOpen(true); }}
                      onEditFixed={(idx) => { setEditingFixedIdx(idx); setIsFixedModalOpen(true); }}
                      onDeleteFixed={handleDeleteFixed}
                      onAddEvent={() => setIsEventModalOpen(true)}
                      onDeleteEvent={handleDeleteEvent}
                      onUpdateSalary={handleUpdateSalary}
                      activeSubTab="distribution"
                      installments={allInstallments}
                      activeMonth={currentMonth}
                      debts={currentMonthDebts}
                      onToggleInstallment={handleToggleInstallment}
                      onToggleDebt={handleToggleDebt}
                      onUpdateAccount={handleUpdateAccount}
                  />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <ExpenseModal
            isOpen={isExpenseModalOpen}
            onClose={() => { setIsExpenseModalOpen(false); setEditingExpenseIdx(null); }}
            onSave={handleSaveExpense}
            initialItem={editingExpenseIdx !== null ? activeData.expenses[editingExpenseIdx] : null}
            defaultMonthStr={currentMonth}
            pastNames={[...new Set(Object.values(budgetState).flatMap(md => (md.expenses || []).map(e => e.name)))].sort()}
        />
        <FixedModal
            isOpen={isFixedModalOpen}
            onClose={() => { setIsFixedModalOpen(false); setEditingFixedIdx(null); }}
            onSave={handleSaveFixed}
            initialItem={editingFixedIdx !== null ? activeData.fixed[editingFixedIdx] : null}
            editingIdx={editingFixedIdx}
        />
        <MonthModal isOpen={isMonthModalOpen} onClose={() => setIsMonthModalOpen(false)} onSave={handleSaveMonth} />
        <CycleModal
            isOpen={isCycleModalOpen}
            onClose={() => { setIsCycleModalOpen(false); setEditingCycleIdx(null); }}
            onSave={handleSaveCycle}
            initialCycle={editingCycleIdx !== null ? (activeData?.cycles?.[editingCycleIdx] ?? null) : null}
        />
        <EventModal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} onSave={handleSaveEvent} />
        <IncomeModal
            isOpen={isIncomeModalOpen}
            onClose={() => { setIsIncomeModalOpen(false); setEditingIncomeId(null); }}
            onSave={handleSaveIncome}
            cycles={activeData.cycles}
            initialItem={editingIncomeId !== null ? (activeData.incomes || []).find((i) => i.id === editingIncomeId) || null : null}
        />
        <InstallmentModal
            isOpen={isInstallmentModalOpen}
            onClose={() => { setIsInstallmentModalOpen(false); setEditingInstallmentId(null); }}
            onSave={handleSaveInstallment}
            initialItem={editingInstallmentId !== null ? allInstallments.find((i) => i.id === editingInstallmentId) || null : null}
            defaultMonthStr={currentMonth}
        />
        <DebtModal
            isOpen={isDebtModalOpen}
            onClose={() => { setIsDebtModalOpen(false); setEditingDebtId(null); }}
            onSave={handleSaveDebt}
            initialItem={editingDebtId !== null ? currentMonthDebts.find((d) => d.id === editingDebtId) || null : null}
            defaultMonthStr={currentMonth}
        />

        {/* 분배 모달 */}
        {isSavingsModalOpen && (
            <div
                className={styles.savingsOverlay}
                onClick={() => setIsSavingsModalOpen(false)}
            >
              <div
                  className={styles.savingsPanel}
                  onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.savingsPanelHeader}>
                  <h2 className={styles.savingsPanelTitle}>분배</h2>
                  <button
                      className={styles.savingsPanelClose}
                      onClick={() => setIsSavingsModalOpen(false)}
                  >
                    <X className={styles.savingsPanelCloseIcon} />  {/* ← h-4 w-4 제거 */}
                  </button>
                </div>
                <div className={styles.savingsPanelBody}>
                  <SavingsTab
                      data={activeData}
                      onToggleAccount={handleToggleAccount}
                      onAddFixed={() => { setEditingFixedIdx(null); setIsFixedModalOpen(true); }}
                      onEditFixed={(idx) => { setEditingFixedIdx(idx); setIsFixedModalOpen(true); }}
                      onDeleteFixed={handleDeleteFixed}
                      onAddEvent={() => setIsEventModalOpen(true)}
                      onDeleteEvent={handleDeleteEvent}
                      onUpdateSalary={handleUpdateSalary}
                      activeSubTab="distribution"
                      installments={allInstallments}
                      activeMonth={currentMonth}
                      debts={currentMonthDebts}
                      onToggleInstallment={handleToggleInstallment}
                      onToggleDebt={handleToggleDebt}
                      onUpdateAccount={handleUpdateAccount}
                  />
                </div>
              </div>
            </div>
        )}

        {/* 하단 고정 탭바 */}
        <nav className={styles.navWrapper}>
          <div className={styles.navBar}>
            {/* 개요 */}
            <button
                className={styles.tabBtn}
                data-active={activeTab === "overview"}
                onClick={() => setActiveTab("overview")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              <span className={styles.tabLabel}>Overview</span>
            </button>

            {/* 지출 */}
            <button
                className={styles.tabBtn}
                data-active={activeTab === "expenses"}
                onClick={() => setActiveTab("expenses")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <span className={styles.tabLabel}>Expenses</span>
            </button>

            {/* 중앙 FAB */}
            <div className={styles.fabWrapper}>
              <button
                  className={styles.fabBtn}
                  title="지출 추가"
                  onClick={() => { setEditingExpenseIdx(null); setIsExpenseModalOpen(true); }}
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>

            {/* 고정 */}
            <button
                className={styles.tabBtn}
                data-active={activeTab === "fixed"}
                onClick={() => setActiveTab("fixed")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span className={styles.tabLabel}>Fixed</span>
            </button>

            {/* 할부·당겨쓰기 */}
            <button
                className={styles.tabBtn}
                data-active={activeTab === "installment"}
                onClick={() => setActiveTab("installment")}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              <span className={styles.tabLabel}>Installment</span>
            </button>

          </div>
        </nav>
      </div>
  );
}