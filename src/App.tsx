import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Header } from "./components/Header";
import { OverviewTab } from "./components/OverviewTab";
import { ExpensesTab } from "./components/ExpensesTab";
import { SavingsTab } from "./components/SavingsTab";
import { MemoTab } from "./components/MemoTab";
import { Account, FixedExpense, BudgetCycle, ExpenseItem, MonthData, BudgetState, EventExpense } from "./types";
import { initialBudgetState, makeDefaultMonth } from "./initialData";
import { ExpenseModal, FixedModal, MonthModal, CycleModal, EventModal } from "./components/Modals";
import { calculateBudgetWithCarryOver } from "./utils/budgetCalculator";
import { initAuth, googleSignIn, logout } from "./utils/firebaseAuth";
import { getSavedSpreadsheetId, createGoogleSheet, syncToGoogleSheet, removeSpreadsheetId, saveSpreadsheetId } from "./utils/googleSheets";

// Tab types
type TabType = "overview" | "expenses" | "savings" | "memo";

export default function App() {
  // ----------------------------------------
  // 1. STATE INITIALIZATION
  // ----------------------------------------
  const [budgetState, setBudgetState] = useState<BudgetState>(() => {
    try {
      const saved = localStorage.getItem("smart_budget_state_v2");
      return saved ? JSON.parse(saved) : initialBudgetState;
    } catch {
      return initialBudgetState;
    }
  });

  const [months, setMonths] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("smart_budget_months_v2");
      if (saved) return JSON.parse(saved);
      return ["2025-05", "2025-06", "2025-07"];
    } catch {
      return ["2025-05", "2025-06", "2025-07"];
    }
  });

  const [currentMonth, setCurrentMonth] = useState<string>("2025-05");
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Google Sheets Auto-Sync States
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => getSavedSpreadsheetId());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Save states inside localstorage whenever they change
  useEffect(() => {
    localStorage.setItem("smart_budget_state_v2", JSON.stringify(budgetState));
  }, [budgetState]);

  useEffect(() => {
    localStorage.setItem("smart_budget_months_v2", JSON.stringify(months));
  }, [months]);

  // Google Auth Listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setGoogleToken(token);
        setSyncError(null);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Real-time Automated Background Sync to Google Sheets
  useEffect(() => {
    if (googleUser && googleToken && spreadsheetId) {
      const runSync = async () => {
        try {
          setIsSyncing(true);
          await syncToGoogleSheet(googleToken, spreadsheetId, months, budgetState);
          setLastSyncTime(new Date());
          setSyncError(null);
        } catch (err: any) {
          console.error("Auto sync failed:", err);
          setSyncError(err.message || "구글 시트 자동 동기화 중 오류가 발생했습니다.");
        } finally {
          setIsSyncing(false);
        }
      };

      const timer = setTimeout(runSync, 1500); // 1.5s debounce to keep API rates efficient
      return () => clearTimeout(timer);
    }
  }, [budgetState, months, googleUser, googleToken, spreadsheetId]);

  // Google Sheets Callbacks
  const handleGoogleSignIn = async () => {
    try {
      setSyncError(null);
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setGoogleToken(res.accessToken);
      }
    } catch (err: any) {
      console.error("Sign in failed:", err);
      setSyncError(err.message || "구글 계정 로그인에 실패했습니다.");
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await logout();
      setGoogleUser(null);
      setGoogleToken(null);
      setSyncError(null);
    } catch (err: any) {
      console.error("Sign out failed:", err);
    }
  };

  const handleCreateSpreadsheet = async () => {
    if (!googleToken) return;
    try {
      setIsSyncing(true);
      setSyncError(null);
      const newId = await createGoogleSheet(googleToken);
      setSpreadsheetId(newId);
      await syncToGoogleSheet(googleToken, newId, months, budgetState);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error("Create sheet failed:", err);
      setSyncError(err.message || "새 스프레드시트 발급 및 연결에 실패했습니다.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = async () => {
    if (!googleToken || !spreadsheetId) return;
    try {
      setIsSyncing(true);
      setSyncError(null);
      await syncToGoogleSheet(googleToken, spreadsheetId, months, budgetState);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error("Manual sync failed:", err);
      setSyncError(err.message || "동기화에 실패했습니다. 유효하지 않은 시트 ID이거나 권한이 부족할 수 있습니다.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectSheet = () => {
    if (window.confirm("구글 스프레드시트 실시간 연동을 해제하시겠습니까? (드라이브의 시트 파일은 유지되며 로컬 브라우저 기기 연결만 끊깁니다.)")) {
      removeSpreadsheetId();
      setSpreadsheetId(null);
      setLastSyncTime(null);
      setSyncError(null);
    }
  };

  const handleConnectExistingSheet = async (id: string) => {
    if (!googleToken) return;
    try {
      setIsSyncing(true);
      setSyncError(null);
      saveSpreadsheetId(id);
      setSpreadsheetId(id);
      await syncToGoogleSheet(googleToken, id, months, budgetState);
      setLastSyncTime(new Date());
    } catch (err: any) {
      console.error("Connect existing sheet failed:", err);
      setSyncError(err.message || "기존 스프레드시트 연결에 실패했습니다. 입력한 ID가 올바르고 권한이 있는지 확인하세요.");
      // rollback state
      removeSpreadsheetId();
      setSpreadsheetId(null);
    } finally {
      setIsSyncing(false);
    }
  };

  // Current month's actual state calculated with dynamic carry-overs sequentially
  const computedState = calculateBudgetWithCarryOver(months, budgetState);
  const activeData: MonthData = computedState[currentMonth] || (budgetState[currentMonth] || makeDefaultMonth(2025, 5));

  // ----------------------------------------
  // 2. MODAL DIALOG CONTROLS & SELECTIONS
  // ----------------------------------------
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseIdx, setEditingExpenseIdx] = useState<number | null>(null);

  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);

  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [editingCycleIdx, setEditingCycleIdx] = useState<number | null>(null);

  // Memo saving status feedback indicator
  const [memoSavingFeedback, setMemoSavingFeedback] = useState(false);
  const memoFeedbackTimer = useRef<NodeJS.Timeout | null>(null);

  // Get memo indicator states for all loaded months
  const memoStates: Record<string, boolean> = {};
  months.forEach((m) => {
    const d = budgetState[m];
    memoStates[m] = !!(d && d.memo && d.memo.trim());
  });

  // Short labels (e.g. "5월")
  const getShortMonthLabel = (key: string) => {
    const [, month] = key.split("-");
    return `${parseInt(month, 10)}월`;
  };

  // ----------------------------------------
  // 3. SERVICE INTERACTION CALLBACKS
  // ----------------------------------------

  // Accounts toggle checklist checker
  const handleToggleAccount = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      mD.accounts = mD.accounts.map((acc, i) =>
        i === idx ? { ...acc, checked: !acc.checked } : acc
      );
      copy[currentMonth] = mD;
      return copy;
    });
  };

  // Expense ADD / EDIT commit
  const handleSaveExpense = (item: ExpenseItem) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const currentExps = [...mD.expenses];

      if (editingExpenseIdx !== null && editingExpenseIdx >= 0) {
        // Edit flow
        currentExps[editingExpenseIdx] = item;
      } else {
        // Add flow
        currentExps.push(item);
      }

      mD.expenses = currentExps;
      copy[currentMonth] = mD;
      return copy;
    });
    setEditingExpenseIdx(null);
  };

  // Expense delete trigger
  const handleDeleteExpense = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const currentExps = [...mD.expenses];
      currentExps.splice(idx, 1);
      mD.expenses = currentExps;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  // Toggle individual expense check status
  const handleToggleExpense = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const currentExps = [...mD.expenses];
      const target = currentExps[idx];
      const isChecked = target.checked !== false;
      currentExps[idx] = { ...target, checked: !isChecked };
      mD.expenses = currentExps;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  // Fixed Expense add
  const handleSaveFixed = (item: FixedExpense) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      mD.fixed = [...mD.fixed, item];
      copy[currentMonth] = mD;
      return copy;
    });
  };

  // Fixed Expense delete
  const handleDeleteFixed = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const currentValue = [...mD.fixed];
      currentValue.splice(idx, 1);
      mD.fixed = currentValue;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  // Special Event Expense add
  const handleSaveEvent = (item: EventExpense) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      mD.events = [...(mD.events || []), item];
      copy[currentMonth] = mD;
      return copy;
    });
  };

  // Special Event Expense delete
  const handleDeleteEvent = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const currentEvents = [...(mD.events || [])];
      currentEvents.splice(idx, 1);
      mD.events = currentEvents;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  // Update budget allocations
  const handleUpdateAllocations = (budget: number, fixedBudget: number, eventBudget: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      mD.budget = budget;
      mD.fixedBudget = fixedBudget;
      mD.eventBudget = eventBudget;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  // Memo auto-saving update
  const handleUpdateMemo = (newMemo: string) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      mD.memo = newMemo;
      copy[currentMonth] = mD;
      return copy;
    });

    // Provide modern fade save indicator feedback
    setMemoSavingFeedback(true);
    if (memoFeedbackTimer.current) clearTimeout(memoFeedbackTimer.current);
    memoFeedbackTimer.current = setTimeout(() => {
      setMemoSavingFeedback(false);
    }, 1200);
  };

  // Add new Month configuration
  const handleSaveMonth = (year: number, month: number, budget: number) => {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (budgetState[key]) {
      alert("이미 동일한 지출월 데이터가 존재합니다. 해당 월을 먼저 선택해주세요.");
      return;
    }

    setBudgetState((prev) => ({
      ...prev,
      [key]: makeDefaultMonth(year, month, budget),
    }));

    setMonths((prev) => {
      const next = [...prev, key];
      next.sort();
      return next;
    });

    setCurrentMonth(key);
    setActiveTab("overview");
  };

  // Delete configured Month
  const handleDeleteMonth = (key: string) => {
    if (months.length <= 1) {
      alert("플래너를 완연하게 구동하기 위해 최소 1개 이상의 지출월 예산이 필요합니다.");
      return;
    }

    const confirmMsg = `${getShortMonthLabel(key)} 전체 지출 내역 및 예산 구조를 플래너에서 안전하게 영구 삭제하시겠습니까?`;
    if (!window.confirm(confirmMsg)) return;

    const idx = months.indexOf(key);
    const newMonths = months.filter((m) => m !== key);
    setMonths(newMonths);

    setBudgetState((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    // Automatically transition safety month focal
    const nextIdx = Math.max(0, Math.min(idx, newMonths.length - 1));
    setCurrentMonth(newMonths[nextIdx]);
    setActiveTab("overview");
  };

  // Cycle modifications
  const handleSaveCycle = (cycle: BudgetCycle) => {
    if (editingCycleIdx === null) return;
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const currentCycles = [...mD.cycles];
      currentCycles[editingCycleIdx] = cycle;
      mD.cycles = currentCycles;
      copy[currentMonth] = mD;
      return copy;
    });
    setEditingCycleIdx(null);
  };

  return (
    <div className="min-h-screen bg-[#F0F0F0] pb-16">
      {/* Dynamic Header */}
      <Header
        months={months}
        currentMonth={currentMonth}
        onSelectMonth={setCurrentMonth}
        onAddMonth={() => setIsMonthModalOpen(true)}
        onDeleteMonth={handleDeleteMonth}
        memoStates={memoStates}
        spreadsheetId={spreadsheetId}
      />

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Segmented control tab bar controller */}
        <div className="grid grid-cols-4 border-2 border-black bg-white rounded-none divide-x-2 divide-black relative overflow-hidden geo-shadow-sm">
          {(["overview", "expenses", "savings", "memo"] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            const labels: Record<TabType, string> = {
              overview: "개요",
              expenses: "지출내역",
              savings: "저축·적금",
              memo: "비고",
            };

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative py-3.5 text-xs font-black uppercase tracking-wider cursor-pointer transition-colors ${
                  isActive ? "bg-black text-white" : "bg-white text-black hover:bg-[#E63946] hover:text-white"
                }`}
              >
                <span className="relative z-20">{labels[tab]}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Contents Frame */}
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
                onEditCycle={(idx) => {
                  setEditingCycleIdx(idx);
                  setIsCycleModalOpen(true);
                }}
                onSwitchTab={(target) => setActiveTab(target as TabType)}
                onUpdateAllocations={handleUpdateAllocations}
                googleUser={googleUser}
                isSyncing={isSyncing}
                lastSyncTime={lastSyncTime}
                syncError={syncError}
                spreadsheetId={spreadsheetId}
                onGoogleSignIn={handleGoogleSignIn}
                onGoogleSignOut={handleGoogleSignOut}
                onCreateSpreadsheet={handleCreateSpreadsheet}
                onManualSync={handleManualSync}
                onDisconnectSheet={handleDisconnectSheet}
                onConnectExistingSheet={handleConnectExistingSheet}
              />
            )}

            {activeTab === "expenses" && (
              <ExpensesTab
                data={activeData}
                onAddExpense={() => {
                  setEditingExpenseIdx(null);
                  setIsExpenseModalOpen(true);
                }}
                onEditExpense={(idx) => {
                  setEditingExpenseIdx(idx);
                  setIsExpenseModalOpen(true);
                }}
                onDeleteExpense={handleDeleteExpense}
                onToggleExpense={handleToggleExpense}
              />
            )}

            {activeTab === "savings" && (
              <SavingsTab
                data={activeData}
                onToggleAccount={handleToggleAccount}
                onAddFixed={() => setIsFixedModalOpen(true)}
                onDeleteFixed={handleDeleteFixed}
                onAddEvent={() => setIsEventModalOpen(true)}
                onDeleteEvent={handleDeleteEvent}
              />
            )}

            {activeTab === "memo" && (
              <MemoTab
                memo={activeData.memo}
                onUpdateMemo={handleUpdateMemo}
                savingIndicator={memoSavingFeedback}
                shortMonthLabel={getShortMonthLabel(currentMonth)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Overlaid Modal Panels */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpenseIdx(null);
        }}
        onSave={handleSaveExpense}
        initialItem={editingExpenseIdx !== null ? activeData.expenses[editingExpenseIdx] : null}
        defaultMonthStr={currentMonth}
      />

      <FixedModal
        isOpen={isFixedModalOpen}
        onClose={() => setIsFixedModalOpen(false)}
        onSave={handleSaveFixed}
      />

      <MonthModal
        isOpen={isMonthModalOpen}
        onClose={() => setIsMonthModalOpen(false)}
        onSave={handleSaveMonth}
      />

      <CycleModal
        isOpen={isCycleModalOpen}
        onClose={() => {
          setIsCycleModalOpen(false);
          setEditingCycleIdx(null);
        }}
        onSave={handleSaveCycle}
        initialCycle={editingCycleIdx !== null ? activeData.cycles[editingCycleIdx] : null}
      />

      <EventModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        onSave={handleSaveEvent}
      />
    </div>
  );
}
