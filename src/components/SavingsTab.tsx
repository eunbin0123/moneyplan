import React from "react";
import { MonthData } from "../types";
import { Check, Calendar, Trash2, CalendarRange, Sparkles, Plus } from "lucide-react";

interface SavingsTabProps {
  data: MonthData;
  onToggleAccount: (idx: number) => void;
  onAddFixed: () => void;
  onDeleteFixed: (idx: number) => void;
  onAddEvent: () => void;
  onDeleteEvent: (idx: number) => void;
}

export const SavingsTab: React.FC<SavingsTabProps> = ({
  data,
  onToggleAccount,
  onAddFixed,
  onDeleteFixed,
  onAddEvent,
  onDeleteEvent,
}) => {
  const formatCurrency = (amount: number) => {
    return Math.round(amount).toLocaleString("ko-KR") + "원";
  };

  // calculate sum of fixed expenses
  const totalFixed = data.fixed.reduce((sum, item) => sum + item.amount, 0);

  // calculate sum of special events
  const totalEvents = data.events ? data.events.reduce((sum, item) => sum + item.amount, 0) : 0;

  return (
    <div className="space-y-6">
      {/* Account Checklist Card */}
      <div className="bg-white border-2 border-black p-5 rounded-none geo-shadow">
        <div className="pb-3 border-b-2 border-black mb-4">
          <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[#E63946]" /> 통장별 이체 현황
          </h3>
        </div>

        <div className="divide-y divide-black/10">
          {data.accounts.map((a, idx) => (
            <div
              key={idx}
              onClick={() => onToggleAccount(idx)}
              className="flex items-center justify-between py-3.5 group cursor-pointer hover:bg-slate-50 px-2 rounded-none transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                {/* Custom Checkbox square */}
                <div
                  className={`h-5 w-5 border-2 border-black flex items-center justify-center transition-all rounded-none ${
                    a.checked
                      ? "bg-black text-white"
                      : "bg-white text-black"
                  }`}
                >
                  {a.checked && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                </div>
                <div>
                  <p className={`text-xs font-black uppercase tracking-wide ${a.checked ? "text-slate-400 line-through" : "text-black"}`}>
                    {a.name}
                  </p>
                  <p className="text-[10px] text-slate-500 font-extrabold font-mono mt-0.5">{formatCurrency(a.amount)}</p>
                </div>
              </div>

              <span>
                <span
                  className={`text-[9px] font-mono font-black uppercase tracking-widest px-2.5 py-1 border-2 border-black rounded-none ${
                    a.checked
                      ? "bg-black text-white"
                      : "bg-white text-slate-400"
                  }`}
                >
                  {a.checked ? "완료" : "대기"}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed Expenses Panel */}
      <div className="bg-white border-2 border-black p-5 rounded-none geo-shadow">
        <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
          <div>
            <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-black" /> 매달 고정 지출
            </h3>
          </div>
          <button
            onClick={onAddFixed}
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-black text-white border-2 border-black px-3 py-1.5 rounded-none hover:bg-[#E63946] hover:border-[#E63946] active:translate-y-0.5 transition-colors cursor-pointer geo-shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> 추가
          </button>
        </div>

        {data.fixed.length === 0 ? (
          <div className="text-center p-8 text-slate-400 text-xs font-medium uppercase tracking-widest">// 고정지출 목록이 비어있습니다.</div>
        ) : (
          <div className="space-y-1">
            {data.fixed.map((f, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-black/10 last:border-0 hover:bg-slate-50 px-2 rounded-none gap-2 sm:gap-4"
              >
                <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto">
                  <div className="px-2 py-0.5 bg-black text-white text-[9px] font-black font-mono border border-black rounded-none uppercase shrink-0">
                    {f.day ? `DAY ${f.day}` : "N/A"}
                  </div>
                  <span className="text-xs font-black text-black truncate uppercase tracking-tight">{f.name}</span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-1.5 sm:pt-0 border-t border-dashed border-black/10 sm:border-0 shrink-0 select-none">
                  <span className="text-xs font-black text-[#E63946] font-mono">-{formatCurrency(f.amount)}</span>
                  <button
                    onClick={() => onDeleteFixed(idx)}
                    className="p-1 px-2.5 bg-white hover:bg-[#E63946] text-black hover:text-white text-[10px] font-black border-2 border-black rounded-none transition-all cursor-pointer"
                    title="대리삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}

            {/* Sum section */}
            <div className="flex justify-between items-center pt-3.5 mt-3.5 border-t-2 border-black font-black uppercase">
              <span className="text-xs text-black tracking-widest">고정지출 총 합계</span>
              <span className="text-sm text-[#E63946] font-mono">-{formatCurrency(totalFixed)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Special family events section */}
      <div className="bg-white border-2 border-black p-5 rounded-none geo-shadow border-l-[8px] border-l-[#E63946]">
        <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
          <div>
            <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-1.5">
              <CalendarRange className="h-4 w-4 text-black" /> 이달의 비정기 경조사비
            </h3>
          </div>
          <button
            onClick={onAddEvent}
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-black text-white border-2 border-black px-3 py-1.5 rounded-none hover:bg-[#E63946] hover:border-[#E63946] active:translate-y-0.5 transition-colors cursor-pointer geo-shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" /> 추가
          </button>
        </div>

        {!data.events || data.events.length === 0 ? (
          <div className="text-center p-8 text-slate-400 text-xs font-medium uppercase tracking-widest">
            // 이번 달 비정기 경조사비 내역이 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {data.events.map((e, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-black bg-[#F9F9F9] px-4 py-3 border-2 border-black rounded-none font-bold gap-2 sm:gap-4"
              >
                <span className="uppercase tracking-tight truncate w-full sm:w-auto">{e.name}</span>
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-1.5 sm:pt-0 border-t border-dashed border-black/10 sm:border-0 shrink-0 select-none">
                  <span className="font-black text-[#E63946] font-mono">-{formatCurrency(e.amount)}</span>
                  <button
                    onClick={() => onDeleteEvent(idx)}
                    className="p-1 px-2.5 bg-white hover:bg-[#E63946] text-black hover:text-white text-[10px] font-black border-2 border-black rounded-none transition-all cursor-pointer"
                    title="경조사비 목록 삭제"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}

            {/* Event total */}
            <div className="flex justify-between items-center pt-3.5 mt-1 border-t-2 border-black text-xs font-black text-black">
              <span>경조사 지출계</span>
              <span className="font-mono text-[#E63946]">-{formatCurrency(totalEvents)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

