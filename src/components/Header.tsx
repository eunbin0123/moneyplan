import React, { useState } from "react";
import { Wallet, Trash2, Menu, X, ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { MemoTab } from "./MemoTab";

interface HeaderProps {
    months: string[];
    currentMonth: string;
    onSelectMonth: (month: string) => void;
    onDeleteMonth: (month: string) => void;
    memoStates: Record<string, boolean>;
    memo: string;
    onUpdateMemo: (newMemo: string) => void;
    memoSavingFeedback: boolean;
    shortMonthLabel: string;
    isMemoOpen: boolean;
    onToggleMemo: () => void;
}

export const Header: React.FC<HeaderProps> = ({
                                                  months,
                                                  currentMonth,
                                                  onSelectMonth,
                                                  onDeleteMonth,
                                                  memoStates,
                                                  memo,
                                                  onUpdateMemo,
                                                  memoSavingFeedback,
                                                  shortMonthLabel,
                                                  isMemoOpen,
                                                  onToggleMemo,
                                              }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const hasMemoContent = !!(memo && memo.trim());

    const fullLabel = (key: string) => {
        const [y, m] = key.split("-");
        return `${y}년 ${parseInt(m, 10)}월`;
    };
    const monthOnly = (key: string) => {
        const [, m] = key.split("-");
        return `${parseInt(m, 10)}월`;
    };

    // 정렬된 달 목록에서 인접 달 계산
    const sorted = [...months].sort();
    const curIdx = sorted.indexOf(currentMonth);
    const prevMonth = curIdx > 0 ? sorted[curIdx - 1] : null;
    const nextMonth = curIdx >= 0 && curIdx < sorted.length - 1 ? sorted[curIdx + 1] : null;

    // 피커용: 연도별 그룹핑
    const byYear: Record<string, string[]> = {};
    sorted.forEach((m) => {
        const [y] = m.split("-");
        (byYear[y] = byYear[y] || []).push(m);
    });
    const years = Object.keys(byYear).sort();

    return (
        <>
            <header className="bg-white border-b-4 border-black sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-black text-white flex items-center justify-center border-2 border-black shrink-0">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <h1 className="text-lg font-extrabold text-black select-none">☆EB's Money☆</h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onToggleMemo}
                                className={`relative inline-flex items-center justify-center h-9 w-9 border-2 transition-all cursor-pointer geo-shadow-sm ${
                                    isMemoOpen
                                        ? "bg-[#E63946] text-white border-[#E63946]"
                                        : "bg-white text-black border-black hover:bg-black hover:text-white"
                                }`}
                                title="이달 메모"
                            >
                                {isMemoOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                                {hasMemoContent && !isMemoOpen && (
                                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-[#E63946] border-2 border-white rounded-full" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* 달 이동: 이전/다음 + 현재월(탭하면 피커) */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => prevMonth && onSelectMonth(prevMonth)}
                            disabled={!prevMonth}
                            className={`h-10 w-10 shrink-0 border-2 border-black flex items-center justify-center transition-all geo-shadow-sm ${
                                prevMonth ? "bg-white text-black hover:bg-black hover:text-white cursor-pointer active:translate-y-0.5" : "bg-slate-100 text-slate-300 cursor-not-allowed"
                            }`}
                            title="이전 달"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>

                        <button
                            onClick={() => setIsPickerOpen(true)}
                            className="flex-1 h-10 border-2 border-black bg-black text-white flex items-center justify-center gap-2 font-black tracking-wider uppercase text-sm hover:bg-[#E63946] transition-all cursor-pointer geo-shadow-sm active:translate-y-0.5"
                            title="달 선택"
                        >
                            <CalendarRange className="h-4 w-4" />
                            {fullLabel(currentMonth)}
                        </button>

                        <button
                            onClick={() => nextMonth && onSelectMonth(nextMonth)}
                            disabled={!nextMonth}
                            className={`h-10 w-10 shrink-0 border-2 border-black flex items-center justify-center transition-all geo-shadow-sm ${
                                nextMonth ? "bg-white text-black hover:bg-black hover:text-white cursor-pointer active:translate-y-0.5" : "bg-slate-100 text-slate-300 cursor-not-allowed"
                            }`}
                            title="다음 달"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* 달 선택 피커 */}
            {isPickerOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
                    onClick={() => setIsPickerOpen(false)}
                >
                    <div
                        className="bg-white border-4 border-black w-full max-w-lg geo-shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-4 border-black px-5 py-4">
                            <h2 className="text-sm font-black text-black uppercase tracking-widest">달 선택</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsPickerOpen(false)}
                                    className="p-1.5 bg-white border-2 border-black text-black hover:bg-[#E63946] hover:text-white transition-all cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-5">
                            {years.map((y) => (
                                <div key={y}>
                                    <p className="text-xs font-black font-mono text-black mb-2.5 bg-slate-100 border-2 border-black px-2.5 py-1 inline-block">
                                        {y}년
                                    </p>
                                    <div className="grid grid-cols-4 gap-2">
                                        {byYear[y].map((m) => {
                                            const isActive = m === currentMonth;
                                            const hasMemo = memoStates[m];
                                            return (
                                                <div key={m} className="relative">
                                                    <button
                                                        onClick={() => { onSelectMonth(m); setIsPickerOpen(false); }}
                                                        className={`w-full h-12 border-2 border-black flex items-center justify-center gap-1 text-xs font-black tracking-wider transition-all cursor-pointer ${
                                                            isActive ? "bg-black text-white geo-shadow-sm" : "bg-white text-black hover:bg-slate-100"
                                                        }`}
                                                    >
                                                        {monthOnly(m)}
                                                        {hasMemo && (
                                                            <span className={`h-1.5 w-1.5 ${isActive ? "bg-[#E63946]" : "bg-[#E63946]"}`} />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onDeleteMonth(m); }}
                                                        title={`${monthOnly(m)} 삭제`}
                                                        className="absolute -top-2 -right-2 h-5 w-5 bg-white border-2 border-black text-black flex items-center justify-center hover:bg-[#E63946] hover:text-white hover:border-[#E63946] transition-all cursor-pointer"
                                                    >
                                                        <Trash2 className="h-2.5 w-2.5" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 메모 모달 */}
            {isMemoOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
                    onClick={onToggleMemo}
                >
                    <div
                        className="bg-white border-4 border-black w-full max-w-lg geo-shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-4 border-black px-5 py-4">
                            <h2 className="text-sm font-black text-black uppercase tracking-widest">{shortMonthLabel} 메모</h2>
                            <button
                                onClick={onToggleMemo}
                                className="p-1.5 bg-white border-2 border-black text-black hover:bg-[#E63946] hover:text-white transition-all cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-5 max-h-[70vh] overflow-y-auto">
                            <MemoTab
                                memo={memo}
                                onUpdateMemo={onUpdateMemo}
                                savingIndicator={memoSavingFeedback}
                                shortMonthLabel={shortMonthLabel}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};