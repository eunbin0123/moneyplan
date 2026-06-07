import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from "./components/Header";
import { OverviewTab } from "./components/OverviewTab";
import { ExpensesTab } from "./components/ExpensesTab";
import { SavingsTab } from "./components/SavingsTab";
import { FixedExpense, BudgetCycle, ExpenseItem, MonthData, BudgetState, EventExpense, IncomeItem, InstallmentItem, DebtItem } from "./types";
import { initialBudgetState, makeDefaultMonth } from "./initialData";
import { ExpenseModal, FixedModal, MonthModal, CycleModal, EventModal, IncomeModal, InstallmentModal, DebtModal } from "./components/Modals";
import { calculateBudgetWithCarryOver } from "./utils/budgetCalculator";
import { saveToFirestore, loadFromFirestore, subscribeToFirestore } from "./utils/firestore";

type TabType = "overview" | "expenses" | "fixed" | "installment" | "savings";

export default function App() {
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

  const firestoreUnsub = useRef<(() => void) | null>(null);
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    localStorage.setItem("smart_budget_state_v2", JSON.stringify(budgetState));
  }, [budgetState]);

  useEffect(() => {
    localStorage.setItem("smart_budget_months_v2", JSON.stringify(months));
  }, [months]);

  useEffect(() => {
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    if (isLoading) return;
    const timer = setTimeout(() => {
      saveToFirestore(months, budgetState).catch(console.error);
    }, 1000);
    return () => clearTimeout(timer);
  }, [budgetState, months, isLoading]);

  useEffect(() => {
    const init = async () => {
      try {
        const remote = await loadFromFirestore();
        if (remote && remote.months.length > 0) {
          isRemoteUpdate.current = true;
          setMonths(remote.months);
          setBudgetState(remote.budgetState);
          setCurrentMonth(findCurrentMonth(remote.months));
        }
      } catch (e) {
        console.error("Firestore 로드 실패:", e);
      } finally {
        setIsLoading(false);
      }
      firestoreUnsub.current = subscribeToFirestore((remoteMonths, remoteBudget) => {
        isRemoteUpdate.current = true;
        setMonths(remoteMonths);
        setBudgetState(remoteBudget);
      });
    };
    init();
    return () => { if (firestoreUnsub.current) firestoreUnsub.current(); };
  }, []);

  const findCurrentMonth = (monthList: string[]) => {
    const today = new Date().toISOString().slice(0, 7);
    if (monthList.includes(today)) return today;
    return monthList[monthList.length - 1];
  };

  const computedState = calculateBudgetWithCarryOver(months, budgetState);
  const activeData: MonthData = computedState[currentMonth] || budgetState[currentMonth] || makeDefaultMonth(2025, 5);

  // 전체 달에 등록된 할부를 평탄화 (할부는 여러 달에 걸치므로 전역으로 모음)
  const allInstallments: InstallmentItem[] = [];
  Object.values(budgetState).forEach((md) => {
    (md.installments || []).forEach((it) => allInstallments.push(it));
  });

  // 이번 달에 차감할 당겨쓰기 목록 (targetMonth === currentMonth)
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

  const handleToggleExpense = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const exps = [...mD.expenses];
      exps[idx] = { ...exps[idx], checked: exps[idx].checked === false ? true : false };
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
      // 총예산 자동분배를 다시 적용하면 주기 고정 해제 → 처음처럼 균등 재분배
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
      copy[currentMonth] = { ...copy[currentMonth], salary: amount };
      return copy;
    });
  };

  const handleSaveInstallment = (item: InstallmentItem) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      // 기존 항목이면 저장돼 있던 달에서 갱신, 신규면 현재 달에 추가
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
      // 기존 항목이면 저장돼 있던 달에서 갱신, 신규면 targetMonth 에 추가
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
      // 자동분배 모드에서 손으로 고치면 그 주기를 고정 → 나머지가 다른 주기로 분배됨
      cycles[editingCycleIdx] = { ...cycle, manual: isAutoMode ? true : undefined };
      mD.cycles = cycles;
      copy[currentMonth] = mD;
      return copy;
    });
    setEditingCycleIdx(null);
  };

  if (isLoading) {
    return (
        <div className="min-h-screen bg-[#F0F0F0] flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-black text-black uppercase tracking-widest">데이터 불러오는 중...</p>
          </div>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-[#F0F0F0] pb-16">
        <Header
            months={months}
            currentMonth={currentMonth}
            onSelectMonth={setCurrentMonth}
            onAddMonth={() => setIsMonthModalOpen(true)}
            onDeleteMonth={handleDeleteMonth}
            memoStates={memoStates}
            memo={activeData.memo}
            onUpdateMemo={handleUpdateMemo}
            memoSavingFeedback={memoSavingFeedback}
            shortMonthLabel={getShortMonthLabel(currentMonth)}
            isMemoOpen={isMemoOpen}
            onToggleMemo={() => setIsMemoOpen(prev => !prev)}
        />

        <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
          <div className="grid grid-cols-5 border-2 border-black bg-white rounded-none divide-x-2 divide-black overflow-hidden geo-shadow-sm">
            {(["overview", "expenses", "fixed", "installment", "savings"] as TabType[]).map((tab) => {
              const labels: Record<TabType, string> = {
                overview: "개요",
                expenses: "지출",
                fixed: "고정",
                installment: "할부・당겨쓰기",
                savings: "분배",
              };
              return (
                  <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`py-3.5 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors ${
                          activeTab === tab ? "bg-black text-white" : "bg-white text-black hover:bg-[#E63946] hover:text-white"
                      }`}
                  >
                    {labels[tab]}
                  </button>
              );
            })}
          </div>

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
                      onUpdateAllocations={handleUpdateAllocations}
                      installments={allInstallments}
                      debts={currentMonthDebts}
                  />
              )}
              {activeTab === "expenses" && (
                  <ExpensesTab
                      data={activeData}
                      onAddExpense={() => { setEditingExpenseIdx(null); setIsExpenseModalOpen(true); }}
                      onEditExpense={(idx) => { setEditingExpenseIdx(idx); setIsExpenseModalOpen(true); }}
                      onDeleteExpense={handleDeleteExpense}
                      onToggleExpense={handleToggleExpense}
                      onReorderExpense={handleReorderExpense}
                      onAddIncome={() => { setEditingIncomeId(null); setIsIncomeModalOpen(true); }}
                      onEditIncome={(id) => { setEditingIncomeId(id); setIsIncomeModalOpen(true); }}
                      onDeleteIncome={handleDeleteIncome}
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
            initialCycle={editingCycleIdx !== null ? activeData.cycles[editingCycleIdx] : null}
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

        <button
            onClick={() => { setEditingExpenseIdx(null); setIsExpenseModalOpen(true); }}
            className="fixed bottom-6 right-6 z-40 h-14 w-14 bg-black text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#E63946] active:scale-95 transition-all cursor-pointer"
            title="지출 추가"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
  );
}