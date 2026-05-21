import React, { useState, useEffect } from "react";
import { MonthData } from "../types";
import { Edit2, ArrowUpRight, TrendingUp, DollarSign, BookOpen, AlertCircle, X, Save, Cloud, CloudOff, RefreshCw, ExternalLink, Link2, LogOut } from "lucide-react";

interface OverviewTabProps {
  data: MonthData;
  activeMonth: string;
  onEditCycle: (idx: number) => void;
  onSwitchTab: (tab: string) => void;
  onUpdateAllocations: (budget: number, fixedBudget: number, eventBudget: number) => void;
  
  // Google Sheets integration props
  googleUser: any;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
  spreadsheetId: string | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onCreateSpreadsheet: () => Promise<void>;
  onManualSync: () => Promise<void>;
  onDisconnectSheet: () => void;
  onConnectExistingSheet: (id: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  data,
  activeMonth,
  onEditCycle,
  onSwitchTab,
  onUpdateAllocations,
  googleUser,
  isSyncing,
  lastSyncTime,
  syncError,
  spreadsheetId,
  onGoogleSignIn,
  onGoogleSignOut,
  onCreateSpreadsheet,
  onManualSync,
  onDisconnectSheet,
  onConnectExistingSheet,
}) => {
  // Modal toggle state
  const [isEditAllocModalOpen, setIsEditAllocModalOpen] = useState(false);
  const [isAddingLabelOpen, setIsAddingLabelOpen] = useState(false);
  const [existingIdInput, setExistingIdInput] = useState("");

  // Modal form states
  const [inputBudget, setInputBudget] = useState("");
  const [inputFixedBudget, setInputFixedBudget] = useState("");
  const [inputEventBudget, setInputEventBudget] = useState("");

  useEffect(() => {
    if (isEditAllocModalOpen) {
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

  // 4. 통합 (Combined/Aggregate)
  const totalCombinedBudget = effectiveMonthlyBudget + fixedAllocBudget + eventAllocBudget;
  const totalCombinedSpent = totalLivingSpent + totalFixedSpent + totalEventSpent;
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
    const bg = parseInt(inputBudget, 10);
    const fx = parseInt(inputFixedBudget, 10);
    const ev = parseInt(inputEventBudget, 10);
    if (isNaN(bg) || bg < 0 || isNaN(fx) || fx < 0 || isNaN(ev) || ev < 0) return;
    onUpdateAllocations(bg, fx, ev);
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
        csvContent += `"날짜","지출 내역","금액","지출 제외 상태"\n`;
        cycleExps.forEach((e) => {
          csvContent += `"${e.date}","${e.name}","${formatCurrency(e.amount)}","${e.checked === false ? "제외됨" : "반영됨"}"\n`;
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
          {googleUser && (
            <div className="text-[10px] text-slate-500 font-extrabold mt-0.5 flex flex-wrap items-center gap-1 justify-center sm:justify-start select-none">
              <span className="text-[#0F9D58] font-black">구글 시트 연동 활성</span>
              <span className="text-slate-300">•</span>
              <span>{googleUser.displayName || googleUser.email}</span>
              {lastSyncTime && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>최종 동기화: {lastSyncTime.toLocaleTimeString("ko-KR")}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Google Sheets Sync Integration Replacing Excel Export */}
          {!googleUser ? (
            <button
              onClick={onGoogleSignIn}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-black bg-white text-black border-2 border-black px-3.5 py-1.5 rounded-none hover:bg-[#0F9D58] hover:text-white hover:border-[#0F9D58] active:translate-y-0.5 transition-all cursor-pointer geo-shadow-sm flex-1 sm:flex-none"
              title="Google 로그인하여 실시간 스프레드시트 동기화를 시작합니다."
            >
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>구글 시트 연동</span>
            </button>
          ) : !spreadsheetId ? (
            <div className="flex items-center gap-1 flex-1 sm:flex-none">
              <button
                onClick={onCreateSpreadsheet}
                disabled={isSyncing}
                className="inline-flex items-center justify-center gap-1 text-[11px] font-black bg-[#0F9D58] text-white border-2 border-black px-2.5 py-1.5 rounded-none hover:bg-[#0b8043] disabled:bg-slate-300 disabled:cursor-not-allowed active:translate-y-0.5 transition-colors cursor-pointer geo-shadow-sm flex-1 sm:flex-none"
                title="새로운 실시간 동기화 구글 시트를 드라이브에 안전하게 생성합니다."
              >
                {isSyncing ? "생성 중..." : "📊 새 구글 시트 제작"}
              </button>
              <button
                onClick={() => {
                  const urlOrId = window.prompt("연결할 구글 스프레드의 링크(URL) 또는 ID를 입력해 주세요:");
                  if (urlOrId) {
                    let id = urlOrId.trim();
                    if (id.includes("/d/")) {
                      const match = id.match(/\/d\/([a-zA-Z0-9-_]+)/);
                      if (match) id = match[1];
                    }
                    onConnectExistingSheet(id);
                  }
                }}
                className="inline-flex items-center justify-center gap-1 text-[11px] font-bold bg-white text-black border-2 border-black px-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded-none transition-colors"
                title="기존 스프레드시트 URL/ID 주소 연결"
              >
                <Link2 className="h-3 w-3" />
              </button>
              <button
                onClick={onGoogleSignOut}
                className="inline-flex items-center justify-center gap-1 text-[11px] font-bold bg-slate-100 text-slate-700 border-2 border-slate-300 hover:text-[#E63946] hover:border-[#E63946] px-2 py-1.5 rounded-none active:translate-y-0.5 transition-all cursor-pointer"
                title="Google 연동 로그아웃"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 flex-1 sm:flex-none">
              <button
                onClick={onManualSync}
                disabled={isSyncing}
                className="inline-flex items-center justify-center gap-1 text-[11px] font-black bg-white text-black border-2 border-black px-2.5 py-1.5 rounded-none hover:bg-slate-50 disabled:bg-slate-100 active:translate-y-0.5 transition-colors cursor-pointer geo-shadow-sm"
                title="실시간 자동 저장 중이나 언제든 즉시 클릭하여 수동 동기화할 수 있습니다."
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
                <span>동기화</span>
              </button>
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                target="_blank"
                rel="noreferrer"
                referrerPolicy="no-referrer"
                className="inline-flex items-center justify-center gap-1 text-[11px] font-black bg-[#EBF7EE] text-[#0F9D58] border-2 border-black px-3 py-1.5 rounded-none hover:bg-[#0F9D58] hover:text-white active:translate-y-0.5 transition-colors cursor-pointer geo-shadow-sm"
                title="연동 완료된 구글 가계부 스프레드시트를 새 탭에서 열어 조회합니다."
              >
                <Cloud className="h-3.5 w-3.5" />
                <span>시트 열기</span>
              </a>
              <button
                onClick={onDisconnectSheet}
                className="inline-flex items-center justify-center gap-1 text-[11px] font-bold bg-white text-slate-400 border-2 border-slate-200 px-2 py-1.5 rounded-none hover:text-[#E63946] hover:border-[#E63946] hover:bg-[#E63946]/5 active:translate-y-0.5 transition-all cursor-pointer"
                title="구글 시트 브라우저 연동 연결 해제"
              >
                <CloudOff className="h-3 w-3" />
              </button>
            </div>
          )}
          <button
            onClick={() => setIsEditAllocModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-black bg-black text-white border-2 border-black px-3.5 py-1.5 rounded-none hover:bg-[#E63946] hover:border-[#E63946] active:translate-y-0.5 transition-colors cursor-pointer geo-shadow-sm flex-1 sm:flex-none"
          >
            <Edit2 className="h-3 w-3 stroke-[3px]" /> 예산 조정
          </button>
        </div>
      </div>

      {syncError && (
        <div className="p-3 bg-[#E63946]/10 border-2 border-[#E63946] text-xs font-bold text-[#E63946] flex items-center gap-2 rounded-none">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{syncError}</span>
        </div>
      )}

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
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">기본 생활비 배정액</span>
                <span className="font-mono font-black text-black">{formatCurrency(baseLivingBudget)}</span>
              </div>
              {carryFromPrevMonth > 0 && (
                <div className="flex justify-between items-center text-xs text-emerald-600 font-bold">
                  <span>지난달 이월금 (+)</span>
                  <span className="font-mono">+{formatCurrency(carryFromPrevMonth)}</span>
                </div>
              )}
              {carryFromPrevMonth > 0 && (
                <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2 pb-1">
                  <span className="text-slate-500 font-bold">총 생활비 예산</span>
                  <span className="font-mono font-black text-black">{formatCurrency(effectiveMonthlyBudget)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">실제 생활비 지출 (-)</span>
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
              <div className="flex justify-between items-center pt-3 border-t border-dashed border-white/20">
                <span className="font-black text-white text-sm">총 지출액 합계</span>
                <div className="text-right">
                  <span className="text-base font-black font-mono text-[#E63946] tracking-tight">{formatCurrency(totalCombinedSpent)}</span>
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">총 예산 {formatCurrency(totalCombinedBudget)} 중</span>
                </div>
              </div>
            </div>
          </div>

          {/* Combined Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-black text-slate-400">
              <span>통합 소진율</span>
              <span className="font-mono">{combinedPct}%</span>
            </div>
            <div className="h-5 w-full bg-neutral-900 border-2 border-black rounded-none overflow-hidden p-[2px]">
              <div
                className={`h-full rounded-none transition-all duration-500 ease-out ${
                  combinedPct >= 100 ? "bg-[#E63946]" : combinedPct >= 80 ? "bg-amber-400" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(combinedPct, 100)}%` }}
              />
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

                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                  <span>지출: {formatCurrency(spent)} / 예산: {formatCurrency(c.budget)} ({pct}%)</span>
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
              onClick={() => onSwitchTab("memo")}
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
              <div>
                <label className="block text-xs font-black text-black mb-1.5 flex justify-between items-center select-none">
                  <span>1. 생활비 예산</span>
                  <span className="text-[10px] text-slate-500 font-bold">주기별 예산 합계로 자동 계산됨</span>
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={formatCurrency(Number(inputBudget))}
                  className="w-full h-11 border-2 border-black bg-slate-100 rounded-none px-3 text-xs font-bold font-mono text-slate-700 outline-none select-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black mb-1.5">
                  2. 고정지출 예산
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
                  3. 비정기 경조사비 예산
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
