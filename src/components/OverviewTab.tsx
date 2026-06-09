import React, { useState, useEffect } from "react";
import { MonthData, InstallmentItem, DebtItem } from "../types";
import { Edit2, ArrowUpRight, TrendingUp, DollarSign, BookOpen, AlertCircle, X, Save } from "lucide-react";

interface OverviewTabProps {
  data: MonthData;
  activeMonth: string;
  onEditCycle: (idx: number) => void;
  onOpenMemo: () => void;
  onUpdateAllocations: (budget: number, fixedBudget: number, eventBudget: number, totalBudget?: number) => void;
  installments?: InstallmentItem[];
  debts?: DebtItem[];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
                                                          data,
                                                          activeMonth,
                                                          onEditCycle,
                                                          onOpenMemo,
                                                          onUpdateAllocations,
                                                          installments = [],
                                                          debts = [],

                                                        }) => {
  // Modal toggle state
  const [isEditAllocModalOpen, setIsEditAllocModalOpen] = useState(false);
  const [isAddingLabelOpen, setIsAddingLabelOpen] = useState(false);
  const [existingIdInput, setExistingIdInput] = useState("");

  // Modal form states
  const [inputTotalBudget, setInputTotalBudget] = useState("");
  const [inputBudget, setInputBudget] = useState("");
  const [inputFixedBudget, setInputFixedBudget] = useState("");
  const [inputEventBudget, setInputEventBudget] = useState("");

  useEffect(() => {
    if (isEditAllocModalOpen) {
      setInputTotalBudget(String(data.totalBudget ?? ""));
      setInputBudget(String(data.budget));
      setInputFixedBudget(String(data.fixedBudget ?? 160000));
      setInputEventBudget(String(data.eventBudget ?? 200000));
    }
  }, [isEditAllocModalOpen, data]);

  // Calculations for 3 Managed Categories:

  // 1. 생활비 (Living Expenses)
  const baseLivingBudget = data.budget;
  const carryFromPrevMonth = data.carryFromPrevMonth ?? 0;
  const effectiveMonthlyBudget = data.effectiveMonthlyBudget ?? baseLivingBudget;

  const totalLivingSpent = data.expenses
      .filter((e) => e.checked !== false)
      .reduce((sum, item) => sum + item.amount, 0);
  const remainingLiving = effectiveMonthlyBudget - totalLivingSpent;
  const livingPct = effectiveMonthlyBudget > 0 ? Math.round((totalLivingSpent / effectiveMonthlyBudget) * 100) : 0;

  // 2. 고정지출 (Fixed Expenses)
  const fixedAllocBudget = data.fixedBudget ?? 160000;
  const totalFixedSpent = data.fixed
      .reduce((sum, item) => sum + item.amount, 0);
  const remainingFixed = fixedAllocBudget - totalFixedSpent;
  const fixedPct = fixedAllocBudget > 0 ? Math.round((totalFixedSpent / fixedAllocBudget) * 100) : 0;

  // 3. 경조사비 (Special Event Expenses)
  const eventAllocBudget = data.eventBudget ?? 200000;
  const totalEventSpent = (data.events || [])
      .reduce((sum, item) => sum + item.amount, 0);
  const remainingEvent = eventAllocBudget - totalEventSpent;
  const eventPct = eventAllocBudget > 0 ? Math.round((totalEventSpent / eventAllocBudget) * 100) : 0;

  // 5. 할부 (Installments) — 시작월부터 개월 수만큼 매달 반영
  const monthIdx = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return y * 12 + (m - 1);
  };
  const installmentChargeThisMonth = (installments || []).reduce((sum, it) => {
    const start = monthIdx(it.startMonth);
    const cur = monthIdx(activeMonth);
    return sum + (cur >= start && cur < start + it.months ? it.monthlyAmount : 0);
  }, 0);

  // 6. 당겨쓰기 (Debt repayment this month)
  const debtChargeThisMonth = (debts || []).reduce((sum, d) => sum + d.amount, 0);

  // 4. 통합 (Combined/Aggregate)
  const totalCombinedBudget = effectiveMonthlyBudget + fixedAllocBudget + eventAllocBudget;
  const totalCombinedSpent = totalLivingSpent + totalFixedSpent + totalEventSpent + installmentChargeThisMonth + debtChargeThisMonth;
  const totalCombinedRemaining = totalCombinedBudget - totalCombinedSpent;
  const combinedPct = totalCombinedBudget > 0 ? Math.round((totalCombinedSpent / totalCombinedBudget) * 100) : 0;

  // Helper to calculate spent for target cycle
  const getCycleSpent = (start: string, end: string) => {
    return data.expenses
        .filter((e) => e.date >= start && e.date <= end && e.checked !== false)
        .reduce((sum, item) => sum + item.amount, 0);
  };

  const getPercentageColor = (pct: number) => {
    if (pct >= 100) return "bg-[#E63946]";
    if (pct >= 80) return "bg-amber-400";
    return "bg-black";
  };

  const getShortMonthLabel = (key: string) => {
    const [, month] = key.split("-");
    return `${parseInt(month, 10)}월`;
  };

  const getCleanLabel = (label: string) => {
    return label.replace(/\s*\(.*?\)\s*/g, "").trim();
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

  const formatCurrency = (amount: number) => {
    return Math.round(amount).toLocaleString("ko-KR") + "원";
  };

  const handleSaveAllocations = (e: React.FormEvent) => {
    e.preventDefault();
    const tb = inputTotalBudget ? parseInt(inputTotalBudget, 10) : NaN;
    const fx = parseInt(inputFixedBudget, 10);
    const ev = parseInt(inputEventBudget, 10);
    if (isNaN(fx) || fx < 0 || isNaN(ev) || ev < 0) return;

    if (!isNaN(tb) && tb > 0) {
      // totalBudget 모드: 생활비는 자동 역산, budget=0 으로 전달 (계산기가 재계산)
      onUpdateAllocations(0, fx, ev, tb);
    } else {
      // 기존 수동 모드
      const bg = parseInt(inputBudget, 10);
      if (isNaN(bg) || bg < 0) return;
      onUpdateAllocations(bg, fx, ev, undefined);
    }
    setIsEditAllocModalOpen(false);
  };

  const handleExportToExcel = () => {
    let csvContent = "\uFEFF";

    csvContent += `"${getShortMonthLabel(activeMonth)} 스마트 가계부 백업 리포트"\n`;
    csvContent += `"출력 일시","${new Date().toLocaleString("ko-KR")}"\n\n`;

    csvContent += `"구분","종합 예산","실제 지출액","남은 잔액","소비 비율"\n`;
    csvContent += `"생활비(주기별 합산)","${formatCurrency(effectiveMonthlyBudget)}","${formatCurrency(totalLivingSpent)}","${formatCurrency(remainingLiving)}","${livingPct}%"\n`;
    csvContent += `"고정 지출","${formatCurrency(fixedAllocBudget)}","${formatCurrency(totalFixedSpent)}","${formatCurrency(remainingFixed)}","${fixedPct}%"\n`;
    csvContent += `"경조사비","${formatCurrency(eventAllocBudget)}","${formatCurrency(totalEventSpent)}","${formatCurrency(remainingEvent)}","${eventPct}%"\n`;
    csvContent += `"전체 가계부 합계","${formatCurrency(totalCombinedBudget)}","${formatCurrency(totalCombinedSpent)}","${formatCurrency(totalCombinedRemaining)}","${combinedPct}%"\n\n`;

    csvContent += `"[1] 생활비 주기별 상세 내역"\n`;
    data.cycles.forEach((c) => {
      const startL = dlabel(c.start);
      const endL = dlabel(c.end);
      const spentObj = getCycleSpent(c.start, c.end);
      const remaining = c.budget - spentObj;
      const pct = c.budget > 0 ? Math.round((spentObj / c.budget) * 100) : 0;

      csvContent += `\n"주기명","기간","지정 예산","지출 합계","남은 잔고","지출 비율"\n`;
      csvContent += `"${getCleanLabel(c.label)}","${startL} ~ ${endL}","${formatCurrency(c.budget)}","${formatCurrency(spentObj)}","${formatCurrency(remaining)}","${pct}%"\n`;

      const cycleExps = data.expenses.filter(
          (e) => e.date >= c.start && e.date <= c.end
      );
      if (cycleExps.length > 0) {
        csvContent += `"날짜","지출 내역","금액","상태"\n`;
        cycleExps.forEach((e) => {
          csvContent += `"${e.date}","${e.name}","${formatCurrency(e.amount)}","${e.checked === false ? "미반영" : (e.paid === true ? "결제완료" : "결제대기")}"\n`;
        });
      } else {
        csvContent += `"- 이 주기에 기록된 생활비 지출 내역이 없습니다."\n`;
      }
    });
    csvContent += `\n`;

    csvContent += `"[2] 고정 지출 목록"\n`;
    if (data.fixed && data.fixed.length > 0) {
      csvContent += `"일자/납부일","지출명","예정 금액"\n`;
      data.fixed.forEach((f) => {
        csvContent += `"${f.day || "매월"}","${f.name}","${formatCurrency(f.amount)}"\n`;
      });
    } else {
      csvContent += `"- 등록된 고정 지출 내역이 없습니다."\n`;
    }
    csvContent += `\n`;

    csvContent += `"[3] 경조사비 목록"\n`;
    if (data.events && data.events.length > 0) {
      csvContent += `"순번","구분/경조사명","금액"\n`;
      data.events.forEach((ev, idx) => {
        csvContent += `"${idx + 1}","${ev.name}","${formatCurrency(ev.amount)}"\n`;
      });
    } else {
      csvContent += `"- 등록된 경조사비 내역이 없습니다."\n`;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `smart_budget_report_${activeMonth}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
      <div className="space-y-6">
        {/* Tab Header with Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b-2 border-black gap-2.5 sm:gap-0">
          <div>
            <h2 className="text-sm sm:text-base font-black text-black flex items-center gap-2 justify-center sm:justify-start select-none">
              📊 {getShortMonthLabel(activeMonth)} 가계부 대시보드
            </h2>

          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">

            <button
                onClick={() => setIsEditAllocModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-black bg-black text-white border-2 border-black px-3.5 py-1.5 rounded-none hover:bg-[#E63946] hover:border-[#E63946] active:translate-y-0.5 transition-colors cursor-pointer geo-shadow-sm flex-1 sm:flex-none"
            >
              <Edit2 className="h-3 w-3 stroke-[3px]" /> 예산 조정
            </button>
          </div>
        </div>

        {/* 2 Grid Elements: 남은 생활비 예산 & 전체 사용내역 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: 남은 생활비 예산 */}
          <div className="bg-white border-4 border-black p-4 sm:p-5.5 rounded-none geo-shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2.5 w-2.5 bg-black" />
                <h3 className="text-xs font-black text-black">남은 생활비 예산</h3>
              </div>

              <div className="space-y-3.5 my-5 border-t border-b border-black/10 py-5">
                {/* 내 예산 + 이월금 = 사용예산 */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">내 예산</span>
                  <span className="font-mono font-black text-black">{formatCurrency(baseLivingBudget)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-emerald-600 font-bold">
                  <span>이월금 (+)</span>
                  <span className="font-mono">+{formatCurrency(carryFromPrevMonth)}</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2 pb-1">
                  <span className="text-slate-600 font-black">사용 예산</span>
                  <span className="font-mono font-black text-black">{formatCurrency(effectiveMonthlyBudget)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">지출 (-)</span>
                  <span className="font-mono font-black text-black">{formatCurrency(totalLivingSpent)}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-dashed border-black/20">
                  <span className="text-slate-900 font-black text-sm">남은 생활비</span>
                  <span className={`text-base font-black font-mono tracking-tight ${remainingLiving < 0 ? "text-[#E63946] bg-[#E63946]/10 px-1.5 py-0.5" : "text-emerald-600"}`}>
                    {formatCurrency(remainingLiving)}
                  </span>
                </div>
              </div>
            </div>

            {/* Living Budget Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-black text-slate-500">
                <span>수행 소진율</span>
                <span className="font-mono">{livingPct}%</span>
              </div>
              <div className="h-5 w-full bg-slate-100 border-2 border-black rounded-none overflow-hidden p-[2px]">
                <div
                    className={`h-full rounded-none transition-all duration-500 ease-out ${getPercentageColor(livingPct)}`}
                    style={{ width: `${Math.min(livingPct, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: 전체 사용내역 */}
          <div className="bg-black text-white border-4 border-black p-4 sm:p-5.5 rounded-none geo-shadow-lg flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2.5 w-2.5 bg-[#E63946]" />
                <h3 className="text-xs font-black text-[#E63946]">전체 사용내역 (총 지출 합산)</h3>
              </div>

              <div className="space-y-3.5 my-5 border-t border-b border-white/20 py-5">
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>일반 생활비 지출</span>
                  <span className="font-mono font-bold">{formatCurrency(totalLivingSpent)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>월 정기 고정비 지출</span>
                  <span className="font-mono font-bold">{formatCurrency(totalFixedSpent)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>비정기 경조사비 지출</span>
                  <span className="font-mono font-bold">{formatCurrency(totalEventSpent)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>이번 달 할부금</span>
                  <span className="font-mono font-bold">{formatCurrency(installmentChargeThisMonth)}</span>
                </div>
                {debtChargeThisMonth > 0 && (
                    <div className="flex justify-between items-center text-xs text-slate-300">
                      <span>당겨쓰기 차감</span>
                      <span className="font-mono font-bold">{formatCurrency(debtChargeThisMonth)}</span>
                    </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t border-dashed border-white/20">
                  <span className="font-black text-white text-sm">총 지출액 합계</span>
                  <div className="text-right">
                    <span className="text-base font-black font-mono text-[#E63946] tracking-tight">{formatCurrency(totalCombinedSpent)}</span>
                  </div>
                </div>
              </div>
            </div>


          </div>
        </div>

        {/* Cycles Breakdown */}

        <div className="bg-white border-2 border-black p-5 rounded-none geo-shadow">
          <div className="flex items-center justify-between pb-3.5 border-b-2 border-black mb-5">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-black">주기별 예산 잔액</h3>
            </div>
          </div>

          <div className="space-y-6">
            {data.cycles.map((c, idx) => {
              const spent = getCycleSpent(c.start, c.end);
              const bal = c.budget - spent; // c.budget is now effective budget inclusive of carryIn
              const pct = c.budget > 0 ? Math.round((spent / c.budget) * 100) : 0;
              const carryIn = c.carryIn ?? 0;
              const baseBudget = c.baseBudget ?? c.budget;

              return (
                  <div key={idx} className="group pb-1">
                    <div className="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 mb-2 select-none">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="text-xs font-black uppercase tracking-wider text-black shrink-0">{getCleanLabel(c.label)}</span>
                        <span className="text-[10px] font-mono text-slate-500 font-extrabold bg-slate-50 px-1.5 py-0.5 border border-black/10 shrink-0">
                      ({dlabel(c.start)} ~ {dlabel(c.end)})
                    </span>
                        <button
                            onClick={() => onEditCycle(idx)}
                            className="text-slate-500 hover:text-[#E63946] hover:bg-slate-100 border border-slate-300 hover:border-[#E63946] px-1 py-0.5 transition-all cursor-pointer font-bold text-[10px] rounded-none flex items-center gap-0.5"
                            title="주기 수정"
                        >
                          ✏️ 수정
                        </button>
                      </div>
                      <span className={`text-xs font-black font-mono shrink-0 ${bal < 0 ? "text-[#E63946]" : "text-emerald-600"}`}>
                    {bal < 0 ? "-" : ""}
                        {formatCurrency(Math.abs(bal))}
                  </span>
                    </div>

                    <div className="h-4 w-full bg-[#F0F0F0] border border-black rounded-none overflow-hidden p-[1px] mb-1.5">
                      <div
                          className={`h-full rounded-none transition-all duration-300 ${getPercentageColor(pct)}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 select-none flex-wrap">
                      <span>내 예산 <span className="font-black text-black">{formatCurrency(baseBudget)}</span></span>
                      {(c as any).incomeAmount > 0 && <span>수입 <span className="font-black text-emerald-600">+{formatCurrency((c as any).incomeAmount)}</span></span>}
                      <span>이월 <span className={`font-black ${carryIn > 0 ? "text-emerald-600" : "text-slate-300"}`}>+{formatCurrency(carryIn)}</span></span>
                      <span>사용예산 <span className="font-black text-black">{formatCurrency(c.budget)}</span></span>
                    </div>
                  </div>
              );
            })}
          </div>
        </div>

        {/* Memo Card Preview */}
        {data.memo && data.memo.trim() && (
            <div className="bg-white border-2 border-black p-5 rounded-none geo-shadow border-l-[8px] border-l-[#E63946]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-black flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-[#E63946]" /> 이번 달 주요 메모
                </h3>
                <button
                    onClick={onOpenMemo}
                    className="text-[10px] bg-black text-white px-2 py-1 hover:bg-[#E63946] transition-colors cursor-pointer"
                >
                  상세 편집 &rarr;
                </button>
              </div>
              <div className="text-xs text-black font-bold tracking-tight leading-relaxed whitespace-pre-wrap pl-3 py-1 border-l-2 border-black">
                {data.memo}
              </div>
            </div>
        )}

        {/* Static Rule book */}
        <div className="bg-black text-white border-2 border-black p-5 rounded-none geo-shadow-sm">
          <h3 className="text-xs font-black text-[#E63946] uppercase mb-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> 나의 가계부 철칙
          </h3>
          <ul className="space-y-3 font-medium">
            <li className="flex items-start gap-2.5 text-xs text-slate-300 leading-normal">
              <span className="h-2 w-2 bg-[#E63946] mt-1 shrink-0" />
              <span>📊 <strong>3대 자금 분할 운영</strong>: 생활비, 고정지출 16만원, 비정기 경조사비 20만원을 별개 풀로 철저 분류.</span>
            </li>
            <li className="flex items-start gap-2.5 text-xs text-slate-300 leading-normal">
              <span className="h-2 w-2 bg-white mt-1 shrink-0" />
              <span>📌 <strong>소진 제어 루틴</strong>: 자금 군별 한도가 소급 초과될 경우, 차등 긴급 조정 실행.</span>
            </li>
            <li className="flex items-start gap-2.5 text-xs text-slate-300 leading-normal">
              <span className="h-2 w-2 bg-white mt-1 shrink-0" />
              <span>🚫 <strong>당겨쓰기 절대 금지</strong>: 주기 예산 한도가 소멸되면 긴급 예산 조율 우선.</span>
            </li>
            <li className="flex items-start gap-2.5 text-xs text-slate-300 leading-normal">
              <span className="h-2 w-2 bg-white mt-1 shrink-0" />
              <span>💳 <strong>즉시 결제 즉시 기입</strong>: 소액 지출이더라도 결제시 오차 없이 바로 등록.</span>
            </li>
          </ul>
        </div>

        {/* ✏️ EDIT ALLOCATIONS DIALOG MODAL */}
        {isEditAllocModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
              <div className="bg-white border-4 border-black rounded-none p-6 w-full max-w-sm geo-shadow-lg text-black">
                <div className="flex items-center justify-between border-b-2 border-black pb-3.5 mb-5 select-none">
                  <h3 className="text-sm font-black text-black">가구 예산 배정액 조율</h3>
                  <button
                      onClick={() => setIsEditAllocModalOpen(false)}
                      className="p-1.5 bg-white border-2 border-black text-black hover:bg-[#E63946] hover:text-white rounded-none cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveAllocations} className="space-y-4">
                  {/* ── 총예산 모드 ── */}
                  <div className="bg-black text-white p-4 border-2 border-black space-y-3">
                    <p className="text-xs font-black text-[#E63946] uppercase tracking-widest flex items-center gap-1.5">
                      ✦ 총예산 자동 분배 모드
                    </p>
                    <div>
                      <label className="block text-xs font-black text-white mb-1.5">
                        이달 총 지출 한도
                        <span className="ml-1 text-[10px] text-slate-400 font-bold normal-case tracking-normal">(비워두면 아래 수동 입력 사용)</span>
                      </label>
                      <input
                          type="number"
                          min="0"
                          placeholder="예) 1000000"
                          value={inputTotalBudget}
                          onChange={(e) => setInputTotalBudget(e.target.value)}
                          className="w-full h-11 border-2 border-white bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
                      />
                    </div>

                    {/* 자동 역산 미리보기 */}
                    {inputTotalBudget && parseInt(inputTotalBudget, 10) > 0 && (() => {
                      const tb = parseInt(inputTotalBudget, 10);
                      const fx = parseInt(inputFixedBudget, 10) || 0;
                      const ev = parseInt(inputEventBudget, 10) || 0;
                      const instCharge = installmentChargeThisMonth;
                      const debtCharge = debtChargeThisMonth;
                      const living = Math.max(0, tb - fx - ev - instCharge - debtCharge);
                      const cycleCount = data.cycles.length || 3;
                      const base = Math.floor(living / cycleCount);
                      const remainder = living - base * cycleCount;
                      return (
                          <div className="text-[10px] font-mono bg-white/10 border border-white/20 p-3 space-y-1.5 text-slate-200">
                            <div className="flex justify-between"><span>총 한도</span><span className="text-white font-black">{tb.toLocaleString("ko-KR")}원</span></div>
                            <div className="flex justify-between"><span>― 고정비</span><span>-{fx.toLocaleString("ko-KR")}원</span></div>
                            <div className="flex justify-between"><span>― 경조사비</span><span>-{ev.toLocaleString("ko-KR")}원</span></div>
                            {instCharge > 0 && <div className="flex justify-between"><span>― 할부금</span><span>-{instCharge.toLocaleString("ko-KR")}원</span></div>}
                            {debtCharge > 0 && <div className="flex justify-between"><span>― 당겨쓰기</span><span>-{debtCharge.toLocaleString("ko-KR")}원</span></div>}
                            <div className="flex justify-between border-t border-white/20 pt-1.5 text-white font-black">
                              <span>생활비 예산</span><span>{living.toLocaleString("ko-KR")}원</span>
                            </div>
                            <div className="flex justify-between text-emerald-400">
                              <span>→ 주기당 ({cycleCount}등분)</span>
                              <span>{base.toLocaleString("ko-KR")}원 {remainder > 0 ? `/ 마지막 +${remainder.toLocaleString("ko-KR")}` : ""}</span>
                            </div>
                          </div>
                      );
                    })()}
                  </div>

                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">또는 수동으로 직접 입력</p>

                  <div>
                    <label className="block text-xs font-black text-black mb-1.5 flex justify-between items-center select-none">
                      <span>생활비 예산 (수동)</span>
                      <span className="text-[10px] text-slate-500 font-bold">총예산 입력 시 자동 계산됨</span>
                    </label>
                    <input
                        type="text"
                        readOnly={!!(inputTotalBudget && parseInt(inputTotalBudget, 10) > 0)}
                        disabled={!!(inputTotalBudget && parseInt(inputTotalBudget, 10) > 0)}
                        value={
                          inputTotalBudget && parseInt(inputTotalBudget, 10) > 0
                              ? (() => {
                                const tb = parseInt(inputTotalBudget, 10);
                                const fx = parseInt(inputFixedBudget, 10) || 0;
                                const ev = parseInt(inputEventBudget, 10) || 0;
                                const living = Math.max(0, tb - fx - ev - installmentChargeThisMonth - debtChargeThisMonth);
                                return living.toLocaleString("ko-KR") + "원 (자동계산)";
                              })()
                              : formatCurrency(Number(inputBudget))
                        }
                        className="w-full h-11 border-2 border-black bg-slate-100 rounded-none px-3 text-xs font-bold font-mono text-slate-700 outline-none select-none cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black mb-1.5">
                      고정지출 예산
                    </label>
                    <input
                        type="number"
                        required
                        min="0"
                        value={inputFixedBudget}
                        onChange={(e) => setInputFixedBudget(e.target.value)}
                        className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-black mb-1.5">
                      비정기 경조사비 예산
                    </label>
                    <input
                        type="number"
                        required
                        min="0"
                        value={inputEventBudget}
                        onChange={(e) => setInputEventBudget(e.target.value)}
                        className="w-full h-11 border-2 border-black bg-white focus:border-[#E63946] focus:ring-1 focus:ring-[#E63946] rounded-none px-3 text-xs font-bold font-mono text-black outline-none"
                    />
                  </div>

                  <div className="flex gap-2.5 pt-2">
                    <button
                        type="button"
                        onClick={() => setIsEditAllocModalOpen(false)}
                        className="flex-1 h-11 bg-white hover:bg-slate-100 text-xs text-black font-black uppercase tracking-wider border-2 border-black rounded-none cursor-pointer geo-shadow-sm active:translate-y-0.5"
                    >
                      취소
                    </button>
                    <button
                        type="submit"
                        className="flex-1 h-11 bg-black hover:bg-[#E63946] text-xs text-white font-black uppercase tracking-wider border-2 border-black rounded-none flex items-center justify-center gap-1 cursor-pointer geo-shadow-sm active:translate-y-0.5"
                    >
                      <Save className="h-4 w-4" /> 저장
                    </button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </div>
  );
};