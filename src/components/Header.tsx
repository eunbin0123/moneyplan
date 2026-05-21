import React from "react";
import { Wallet, Plus, Trash2, CalendarRange, Sparkles, Cloud } from "lucide-react";

interface HeaderProps {
  months: string[];
  currentMonth: string;
  onSelectMonth: (month: string) => void;
  onAddMonth: () => void;
  onDeleteMonth: (month: string) => void;
  memoStates: Record<string, boolean>;
  spreadsheetId?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  months,
  currentMonth,
  onSelectMonth,
  onAddMonth,
  onDeleteMonth,
  memoStates,
  spreadsheetId,
}) => {
  const getDisplayLabel = (key: string) => {
    const [, month] = key.split("-");
    return `${parseInt(month, 10)}월`;
  };

  return (
    <header className="bg-white border-b-4 border-black sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 py-5">
        {/* Brand bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-3 justify-between sm:justify-start w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 bg-black text-white flex items-center justify-center border-2 border-black rounded-none shrink-0">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-black flex items-center gap-2 select-none">
                  ☆EB's Money Plan☆
                </h1>
              </div>
            </div>

            {spreadsheetId && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EBF7EE] text-[#0F9D58] border-2 border-black rounded-none text-[10px] font-black uppercase tracking-wider select-none shrink-0 animate-pulse">
                <Cloud className="h-3 w-3" />
                <span>시트 실시간 저장 중</span>
              </div>
            )}
          </div>
          
          <button
            onClick={onAddMonth}
            className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-white text-black border-2 border-black rounded-none text-xs font-black uppercase tracking-wider hover:bg-[#E63946] hover:text-white hover:border-[#E63946] active:translate-y-0.5 transition-all cursor-pointer geo-shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            달 추가
          </button>
        </div>


        {/* Month selector tab bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-thin">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 border-2 border-black flex items-center justify-center bg-black text-white shrink-0">
              <CalendarRange className="h-4 w-4" />
            </div>
            {months.map((m) => {
              const isActive = m === currentMonth;
              const hasMemo = memoStates[m];
              return (
                <div
                  key={m}
                  className={`relative flex items-center gap-0.5 border-2 border-black transition-all shrink-0 ${
                    isActive
                      ? "bg-black text-white geo-shadow-sm"
                      : "bg-white text-black hover:bg-slate-100"
                  }`}
                >
                  <button
                    onClick={() => onSelectMonth(m)}
                    className="pl-3 pr-2 py-1.5 text-xs font-black tracking-widest uppercase cursor-pointer flex items-center gap-1.5"
                  >
                    {getDisplayLabel(m)}
                    {hasMemo && (
                      <span className={`h-2 w-2 bg-[#E63946] ${isActive ? "animate-pulse" : ""}`} />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteMonth(m);
                    }}
                    className={`pr-2.5 py-1.5 opacity-60 hover:opacity-100 hover:text-[#E63946] transition-all duration-150 cursor-pointer text-xs font-bold`}
                    title={`${getDisplayLabel(m)} 삭제`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};

