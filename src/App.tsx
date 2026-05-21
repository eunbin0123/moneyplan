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
import { saveToFirestore, loadFromFirestore, subscribeToFirestore } from "./utils/firestore";

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

  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    const saved = localStorage.getItem("smart_budget_months_v2");
    if (saved) {
      const arr = JSON.parse(saved);
      return arr[arr.length - 1] || "2025-05";
    }
    return "2025-05";
  });
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Firestore 실시간 리스너 제어용 (로그인 후 구독)
  const firestoreUnsub = useRef<(() => void) | null>(null);
  // Firestore에서 받은 업데이트인지 구분 (무한루프 방지)
  const isRemoteUpdate = useRef(false);

  // Google Sheets Auto-Sync States
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => getSavedSpreadsheetId());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // localStorage 백업 (오프라인 대비)
  useEffect(() => {
    localStorage.setItem("smart_budget_state_v2", JSON.stringify(budgetState));
  }, [budgetState]);

  useEffect(() => {
    localStorage.setItem("smart_budget_months_v2", JSON.stringify(months));
  }, [months]);

  // Firestore 저장 (원격 업데이트는 저장 안 함 - 무한루프 방지)
  useEffect(() => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    if (!googleUser) return;

    const timer = setTimeout(() => {
      saveToFirestore(months, budgetState).catch(console.error);
    }, 1000); // 1초 디바운스

    return () => clearTimeout(timer);
  }, [budgetState, months, googleUser]);

  // Google Auth Listener
  useEffect(() => {
    const unsubscribe = initAuth(
        async (user, token) => {
          setGoogleUser(user);
          setGoogleToken(token);
          setSyncError(null);

          // 로그인 직후 Firestore에서 데이터 불러오기
          try {
            const remote = await loadFromFirestore();
            if (remote && remote.months.length > 0) {
              isRemoteUpdate.current = true;
              setMonths(remote.months);
              setBudgetState(remote.budgetState);
              setCurrentMonth(remote.months[remote.months.length - 1]);
            }
          } catch (e) {
            console.error("Firestore 초기 로드 실패:", e);
          }

          // 실시간 리스너 등록
          if (firestoreUnsub.current) firestoreUnsub.current();
          firestoreUnsub.current = subscribeToFirestore((remoteMonths, remoteBudget) => {
            isRemoteUpdate.current = true;
            setMonths(remoteMonths);
            setBudgetState(remoteBudget);
          });
        },
        () => {
          setGoogleUser(null);
          setGoogleToken(null);
          // 리스너 해제
          if (firestoreUnsub.current) {
            firestoreUnsub.current();
            firestoreUnsub.current = null;
          }
        }
    );
    return () => {
      unsubscribe();
      if (firestoreUnsub.current) firestoreUnsub.current();
    };
  }, []);

  // Google Sheets 자동 동기화 (데이터 변경 시)
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

      const timer = setTimeout(runSync, 1500);
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
      if (firestoreUnsub.current) {
        firestoreUnsub.current();
        firestoreUnsub.current = null;
      }
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
      setSyncError(err.message || "동기화에 실패했습니다.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectSheet = () => {
    if (window.confirm("구글 스프레드시트 실시간 연동을 해제하시겠습니까?")) {
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
      setSyncError(err.message || "기존 스프레드시트 연결에 실패했습니다.");
      removeSpreadsheetId();
      setSpreadsheetId(null);
    } finally {
      setIsSyncing(false);
    }
  };

  const computedState = calculateBudgetWithCarryOver(months, budgetState);
  const activeData: MonthData = computedState[currentMonth] || (budgetState[currentMonth] || makeDefaultMonth(2025, 5));

  // ----------------------------------------
  // 2. MODAL DIALOG CONTROLS
  // ----------------------------------------
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseIdx, setEditingExpenseIdx] = useState<number | null>(null);
  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [editingCycleIdx, setEditingCycleIdx] = useState<number | null>(null);
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

  // ----------------------------------------
  // 3. CALLBACKS
  // ----------------------------------------
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

  const handleSaveExpense = (item: ExpenseItem) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const currentExps = [...mD.expenses];
      if (editingExpenseIdx !== null && editingExpenseIdx >= 0) {
        currentExps[editingExpenseIdx] = item;
      } else {
        currentExps.push(item);
      }
      mD.expenses = currentExps;
      copy[currentMonth] = mD;
      return copy;
    });
    setEditingExpenseIdx(null);
  };

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

  const handleToggleExpense = (idx: number) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      const currentExps = [...mD.expenses];
      const target = currentExps[idx];
      currentExps[idx] = { ...target, checked: target.checked === false ? true : false };
      mD.expenses = currentExps;
      copy[currentMonth] = mD;
      return copy;
    });
  };

  const handleSaveFixed = (item: FixedExpense) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      mD.fixed = [...mD.fixed, item];
      copy[currentMonth] = mD;
      return copy;
    });
  };

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
      const currentEvents = [...(mD.events || [])];
      currentEvents.splice(idx, 1);
      mD.events = currentEvents;
      copy[currentMonth] = mD;
      return copy;
    });
  };

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

  const handleUpdateMemo = (newMemo: string) => {
    setBudgetState((prev) => {
      const copy = { ...prev };
      const mD = { ...copy[currentMonth] };
      mD.memo = newMemo;
      copy[currentMonth] = mD;
      return copy;
    });
    setMemoSavingFeedback(true);
    if (memoFeedbackTimer.current) clearTimeout(memoFeedbackTimer.current);
    memoFeedbackTimer.current = setTimeout(() => {
      setMemoSavingFeedback(false);
    }, 1200);
  };

  const handleSaveMonth = (year: number, month: number, budget: number) => {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (budgetState[key]) {
      alert("이미 동일한 지출월 데이터가 존재합니다.");
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

  const handleDeleteMonth = (key: string) => {
    if (months.length <= 1) {
      alert("최소 1개 이상의 지출월이 필요합니다.");
      return;
    }
    if (!window.confirm(`${getShortMonthLabel(key)} 전체 내역을 삭제하시겠습니까?`)) return;

    const idx = months.indexOf(key);
    const newMonths = months.filter((m) => m !== key);
    setMonths(newMonths);
    setBudgetState((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    const nextIdx = Math.max(0, Math.min(idx, newMonths.length - 1));
    setCurrentMonth(newMonths[nextIdx]);
    setActiveTab("overview");
  };

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
        <FixedModal isOpen={isFixedModalOpen} onClose={() => setIsFixedModalOpen(false)} onSave={handleSaveFixed} />
        <MonthModal isOpen={isMonthModalOpen} onClose={() => setIsMonthModalOpen(false)} onSave={handleSaveMonth} />
        <CycleModal
            isOpen={isCycleModalOpen}
            onClose={() => {
              setIsCycleModalOpen(false);
              setEditingCycleIdx(null);
            }}
            onSave={handleSaveCycle}
            initialCycle={editingCycleIdx !== null ? activeData.cycles[editingCycleIdx] : null}
        />
        <EventModal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} onSave={handleSaveEvent} />
      </div>
  );
}