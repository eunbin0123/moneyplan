import React, { useEffect, useRef } from "react";
import { Wallet, Plus, Trash2, CalendarRange, Menu, X } from "lucide-react";
import { MemoTab } from "./MemoTab";

interface HeaderProps {
    months: string[];
    currentMonth: string;
    onSelectMonth: (month: string) => void;
    onAddMonth: () => void;
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
                                                  onAddMonth,
                                                  onDeleteMonth,
                                                  memoStates,
                                                  memo,
                                                  onUpdateMemo,
                                                  memoSavingFeedback,
                                                  shortMonthLabel,
                                                  isMemoOpen,
                                                  onToggleMemo,
                                              }) => {
    const getDisplayLabel = (key: string) => {
        const [, month] = key.split("-");
        return `${parseInt(month, 10)}월`;
    };

    const activeRef = useRef<HTMLDivElement>(null);
    const hasMemoContent = !!(memo && memo.trim());

    useEffect(() => {
        if (activeRef.current) {
            activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    }, [currentMonth]);

    return (
        <>
            <header className="bg-white border-b-4 border-black sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-black text-white flex items-center justify-center border-2 border-black shrink-0">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <h1 className="text-lg font-extrabold text-black select-none">EB's Money Plan</h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={onAddMonth}
                                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-white text-black border-2 border-black text-xs font-black uppercase tracking-wider hover:bg-[#E63946] hover:text-white hover:border-[#E63946] active:translate-y-0.5 transition-all cursor-pointer geo-shadow-sm whitespace-nowrap"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                달 추가
                            </button>

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

                    <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-thin">
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
                                        ref={isActive ? activeRef : null}
                                        className={`relative flex items-center gap-0.5 border-2 border-black transition-all shrink-0 ${
                                            isActive ? "bg-black text-white geo-shadow-sm" : "bg-white text-black hover:bg-slate-100"
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
                                            onClick={(e) => { e.stopPropagation(); onDeleteMonth(m); }}
                                            className="pr-2.5 py-1.5 opacity-60 hover:opacity-100 hover:text-[#E63946] transition-all duration-150 cursor-pointer text-xs font-bold"
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