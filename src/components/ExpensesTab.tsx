import React, { useState } from "react";
import { MonthData, ExpenseItem } from "../types";
import { Plus, ChevronDown, Trash2, Edit2, Archive, HelpCircle, Check } from "lucide-react";

interface ExpensesTabProps {
  data: MonthData;
  onAddExpense: () => void;
  onEditExpense: (idx: number) => void;
  onDeleteExpense: (idx: number) => void;
  onToggleExpense: (idx: number) => void;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
                                                          data,
                                                          onAddExpense,
                                                          onEditExpense,
                                                          onDeleteExpense,
                                                          onToggleExpense,
                                                        }) => {
  // 현재 날짜가 포함된 주기만 열고 나머지는 닫기
  const getInitialCollapsed = () => {
    const today = new Date().toISOString().split("T")[0];
    const result: Record<number, boolean> = {};
    data.cycles.forEach((c, i) => {
      const isCurrentCycle = today >= c.start && today <= c.end;
      result[i] = !isCurrentCycle; // true = collapsed
    });
    return result;
  };

  const [collapsed, setCollapsed] = useState<Record<number, boolean>>(getInitialCollapsed);

  const toggleCollapse = (idx: number) => {
    setCollapsed((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Helper: Get expenses belonging to a cycle
  const getCycleExpenses = (start: string, end: string) => {
    return data.expenses
        .filter((e) => e.date >= start && e.date <= end)
        .sort((a, b) => b.date.localeCompare(a.date)); // descending date
  };

  // Helper: Calculate total spent for a cycle
  const getCycleSpent = (start: string, end: string) => {
    return data.expenses
        .filter((e) => e.date >= start && e.date <= end && e.checked !== false)
        .reduce((sum, item) => sum + item.amount, 0);
  };

  // Helper: Find unclassified expenses (not fitting any cycle's start/end dates)
  const getUnclassifiedExpenses = () => {
    return data.expenses.filter((e) => {
      const fitsAny = data.cycles.some((c) => e.date >= c.start && e.date <= c.end);
      return !fitsAny;
    });
  };

  const dlabel = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");
      if (parts.length >= 3) {
        return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getCleanLabel = (label: string) => {
    return label.replace(/\s*\(.*?\)\s*/g, "").trim();
  };

  const formatCurrency = (amount: number) => {
    return Math.round(amount).toLocaleString("ko-KR") + "원";
  };

  return (
      <div className="space-y-4">
        {/* Container Header */}
        <div className="flex items-center justify-between pb-2">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-black">지출 내역 기록</h2>
          </div>
          <button
              onClick={onAddExpense}
              className="inline-flex items-center gap-1.5 bg-black border-2 border-black text-white hover:bg-[#E63946] hover:border-[#E63946] active:translate-y-0.5 text-xs font-black uppercase tracking-wider px-4 py-2 rounded-none transition-all cursor-pointer geo-shadow-sm"
          >
            <Plus className="h-4 w-4" /> 지출 추가
          </button>
        </div>

        {/* Main folder views */}
        <div className="space-y-3.5">
          {data.cycles.map((c, ci) => {
            const cycleExps = getCycleExpenses(c.start, c.end);
            const spent = getCycleSpent(c.start, c.end);
            const bal = c.budget - spent;
            const isOpen = !collapsed[ci]; // defaults to true (open)

            return (
                <div key={ci} className="bg-white border-2 border-black rounded-none overflow-hidden geo-shadow">
                  {/* Folder Accordion Header */}
                  <div
                      onClick={() => toggleCollapse(ci)}
                      className="flex items-center justify-between p-4 bg-[#F9F9F9] hover:bg-slate-100 active:bg-slate-200 border-b-2 border-black cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChevronDown
                          className={`h-4 w-4 text-black transition-transform duration-200 ${
                              isOpen ? "transform rotate-0" : "transform -rotate-90"
                          }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase tracking-wider text-black">{getCleanLabel(c.label)}</span>
                          <span className="text-[10px] font-mono text-black font-extrabold bg-white px-1.5 py-0.5 border border-black">
                        ({dlabel(c.start)} ~ {dlabel(c.end)})
                      </span>

                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                          지출 {formatCurrency(spent)} / 예산 {formatCurrency(c.budget)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`text-xs font-black font-mono ${bal < 0 ? "text-[#E63946]" : "text-black"}`}>
                        {bal < 0 ? "-" : ""}
                        {formatCurrency(Math.abs(bal))}
                      </div>
                    </div>
                  </div>

                  {/* Folder list body */}
                  {isOpen && (
                      <div className="divide-y divide-black/10 max-h-[380px] overflow-y-auto">
                        {cycleExps.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs font-medium uppercase tracking-widest bg-white">
                              <Archive className="h-8 w-8 text-black mx-auto mb-2.5 stroke-1" />
                              기록된 지출 내역이 없습니다.
                            </div>
                        ) : (
                            cycleExps.map((e) => {
                              // find real original index inside state for callback
                              const originalIdx = data.expenses.findIndex((item) => item === e);

                              return (
                                  <div
                                      key={originalIdx}
                                      className="flex items-center justify-between p-3.5 gap-3 hover:bg-slate-50 transition-colors"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      {/* Checkbox */}
                                      <button
                                          onClick={(evt) => {
                                            evt.stopPropagation();
                                            onToggleExpense(originalIdx);
                                          }}
                                          className={`h-5 w-5 border-2 border-black flex items-center justify-center transition-all shrink-0 rounded-none cursor-pointer ${
                                              e.checked !== false ? "bg-black text-white hover:bg-[#E63946] hover:text-white" : "bg-white text-black hover:bg-slate-100"
                                          }`}
                                          title={e.checked !== false ? "지출 미반영하기" : "지출 반영하기"}
                                      >
                                        {e.checked !== false && <Check className="h-3.5 w-3.5 stroke-[3.5px]" />}
                                      </button>

                                      <div className="min-w-0 flex-1">
                                        <p className={`text-xs font-black truncate transition-all ${e.checked !== false ? "text-black" : "text-slate-400 line-through decoration-black/40 decoration-2"}`}>
                                          {e.name}
                                        </p>
                                        <p className="text-[9.5px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-0.5">{e.date}</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                            <span className={`text-xs font-black font-mono transition-all ${e.checked !== false ? "text-black" : "text-slate-400 line-through decoration-black/40 decoration-2"}`}>
                              -{formatCurrency(e.amount)}
                            </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => onEditExpense(originalIdx)}
                                            className="p-1 px-2.5 bg-white hover:bg-black border border-black text-[10px] text-black hover:text-white font-bold transition-all cursor-pointer rounded-none"
                                            title="일정 편집"
                                        >
                                          수정
                                        </button>
                                        <button
                                            onClick={() => onDeleteExpense(originalIdx)}
                                            className="p-1 px-2.5 bg-white hover:bg-[#E63946] border border-black hover:border-[#E63946] text-[10px] text-black hover:text-white font-bold transition-all cursor-pointer rounded-none"
                                            title="지출 삭제"
                                        >
                                          삭제
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                              );
                            })
                        )}
                      </div>
                  )}
                </div>
            );
          })}

          {getUnclassifiedExpenses().length > 0 && (() => {
            const unclassifiedExps = getUnclassifiedExpenses();
            const spent = unclassifiedExps
                .filter((e) => e.checked !== false)
                .reduce((sum, item) => sum + item.amount, 0);
            const isOpen = !collapsed[-1];

            return (
                <div className="bg-white border-2 border-black rounded-none overflow-hidden geo-shadow border-dashed">
                  <div
                      onClick={() => toggleCollapse(-1)}
                      className="flex items-center justify-between p-4 bg-[#FFF5F5] hover:bg-slate-100 active:bg-slate-200 border-b-2 border-black border-dashed cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChevronDown
                          className={`h-4 w-4 text-black transition-transform duration-200 ${
                              isOpen ? "transform rotate-0" : "transform -rotate-90"
                          }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase tracking-wider text-[#E63946]">미분류 지출 (설정된 주기 외)</span>
                          <span className="text-[10px] font-bold text-slate-400">주기 설정 범위를 벗어난 지출입니다.</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                          {unclassifiedExps.length}개 항목 | 지출 {formatCurrency(spent)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-black font-mono text-[#E63946]">
                        -{formatCurrency(spent)}
                      </div>
                    </div>
                  </div>

                  {isOpen && (
                      <div className="divide-y divide-black/10 max-h-[380px] overflow-y-auto">
                        {unclassifiedExps.map((e) => {
                          const originalIdx = data.expenses.findIndex((item) => item === e);

                          return (
                              <div
                                  key={originalIdx}
                                  className="flex items-center justify-between p-3.5 gap-3 hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <button
                                      onClick={(evt) => {
                                        evt.stopPropagation();
                                        onToggleExpense(originalIdx);
                                      }}
                                      className={`h-5 w-5 border-2 border-black flex items-center justify-center transition-all shrink-0 rounded-none cursor-pointer ${
                                          e.checked !== false ? "bg-black text-white hover:bg-[#E63946] hover:text-white" : "bg-white text-black hover:bg-slate-100"
                                      }`}
                                      title={e.checked !== false ? "지출 미반영하기" : "지출 반영하기"}
                                  >
                                    {e.checked !== false && <Check className="h-3.5 w-3.5 stroke-[3.5px]" />}
                                  </button>

                                  <div className="min-w-0 flex-1">
                                    <p className={`text-xs font-black truncate transition-all ${e.checked !== false ? "text-black" : "text-slate-400 line-through decoration-black/40 decoration-2"}`}>
                                      {e.name}
                                    </p>
                                    <p className="text-[9.5px] font-mono text-slate-400 font-bold uppercase tracking-wider mt-0.5">{e.date}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-xs font-black font-mono transition-all ${e.checked !== false ? "text-black" : "text-slate-400 line-through decoration-black/40 decoration-2"}`}>
                            -{formatCurrency(e.amount)}
                          </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => onEditExpense(originalIdx)}
                                        className="p-1 px-2.5 bg-white hover:bg-black border border-black text-[10px] text-black hover:text-white font-bold transition-all cursor-pointer rounded-none"
                                        title="일정 편집"
                                    >
                                      수정
                                    </button>
                                    <button
                                        onClick={() => onDeleteExpense(originalIdx)}
                                        className="p-1 px-2.5 bg-white hover:bg-[#E63946] border border-black hover:border-[#E63946] text-[10px] text-black hover:text-white font-bold transition-all cursor-pointer rounded-none"
                                        title="지출 삭제"
                                    >
                                      삭제
                                    </button>
                                  </div>
                                </div>
                              </div>
                          );
                        })}
                      </div>
                  )}
                </div>
            );
          })()}
        </div>
      </div>
  );
};