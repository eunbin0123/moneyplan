import React, { useState, useEffect } from "react";
import { MonthData, InstallmentItem } from "../types";
import { Check, Calendar, Trash2, CalendarRange, Sparkles, Plus, CreditCard } from "lucide-react";

interface SavingsTabProps {
    data: MonthData;
    onToggleAccount: (idx: number) => void;
    onAddFixed: () => void;
    onEditFixed: (idx: number) => void;
    onDeleteFixed: (idx: number) => void;
    onAddEvent: () => void;
    onDeleteEvent: (idx: number) => void;
    onUpdateSalary: (amount: number) => void;
    activeSubTab?: "distribution" | "fixed";
    onSubTabChange?: (tab: "distribution" | "fixed") => void;
    installments?: InstallmentItem[];
    activeMonth?: string;
    onAddInstallment?: () => void;
    onEditInstallment?: (id: string) => void;
    onDeleteInstallment?: (id: string) => void;
}

export const SavingsTab: React.FC<SavingsTabProps> = ({
                                                          data,
                                                          onToggleAccount,
                                                          onAddFixed,
                                                          onEditFixed,
                                                          onDeleteFixed,
                                                          onAddEvent,
                                                          onDeleteEvent,
                                                          onUpdateSalary,
                                                          activeSubTab = "distribution",
                                                          onSubTabChange,
                                                          installments = [],
                                                          activeMonth = "",
                                                          onAddInstallment,
                                                          onEditInstallment,
                                                          onDeleteInstallment,
                                                      }) => {
    const formatCurrency = (amount: number) => {
        return Math.round(amount).toLocaleString("ko-KR") + "원";
    };

    const totalFixed = data.fixed.reduce((sum, item) => sum + item.amount, 0);
    const totalEvents = data.events ? data.events.reduce((sum, item) => sum + item.amount, 0) : 0;

    // 할부: 월 인덱스 기준으로 현재 월에 걸치는지/몇 회차인지 계산
    const monthIdx = (key: string) => {
        const [y, m] = key.split("-").map(Number);
        return y * 12 + (m - 1);
    };
    const instStatus = (it: InstallmentItem) => {
        if (!activeMonth) return { state: "none" as const, n: 0 };
        const start = monthIdx(it.startMonth);
        const cur = monthIdx(activeMonth);
        if (cur < start) return { state: "upcoming" as const, n: 0 };
        if (cur >= start + it.months) return { state: "done" as const, n: it.months };
        return { state: "active" as const, n: cur - start + 1 };
    };
    const sortedInstallments = [...installments].sort((a, b) =>
        a.startMonth === b.startMonth ? a.name.localeCompare(b.name) : a.startMonth < b.startMonth ? -1 : 1
    );
    const totalInstallmentThisMonth = installments.reduce(
        (sum, it) => sum + (instStatus(it).state === "active" ? it.monthlyAmount : 0), 0
    );

    // 생활비 = effectiveMonthlyBudget (이월 포함) 또는 budget
    const livingBudget = data.effectiveMonthlyBudget ?? data.budget;
    const livingAmount = livingBudget > 0 ? livingBudget : data.accounts[0]?.amount ?? 0;

    // 체크된 항목만 이체 합계 (생활비는 livingAmount 기준)
    const checkedCount = data.accounts.filter((a) => a.checked).length;
    const totalTransfer = data.accounts.reduce((sum, a, idx) => {
        if (!a.checked) return sum;
        return sum + (idx === 0 ? livingAmount : a.amount);
    }, 0);
    const totalPlanned = data.accounts.reduce((sum, a, idx) =>
        sum + (idx === 0 ? livingAmount : a.amount), 0);

    // 월급 관련
    const salary = data.salary ?? 0;
    const remaining = salary > 0 ? salary - totalTransfer : null;
    const usedPct = salary > 0 ? Math.min(Math.round((totalTransfer / salary) * 100), 100) : 0;

    const [salaryInput, setSalaryInput] = useState(salary > 0 ? String(salary) : "");
    const [isEditingSalary, setIsEditingSalary] = useState(false);

    // 외부 salary 값 변경 시 input 동기화
    useEffect(() => {
        setSalaryInput(salary > 0 ? String(salary) : "");
    }, [salary]);

    const handleSalarySave = () => {
        const val = parseInt(salaryInput.replace(/,/g, ""), 10);
        if (!isNaN(val) && val > 0) {
            onUpdateSalary(val);
        }
        setIsEditingSalary(false);
    };

    return (
        <div className="space-y-4">
            {activeSubTab === "distribution" && (
                <div className="space-y-4">
                    {/* 월급 입력 카드 */}
                    <div className="bg-white border-2 border-black p-4 geo-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-black uppercase tracking-widest text-black">이번달 월급</p>
                            {!isEditingSalary && (
                                <button
                                    onClick={() => setIsEditingSalary(true)}
                                    className="text-[10px] font-black px-2.5 py-1 border-2 border-black bg-white hover:bg-black hover:text-white transition-all cursor-pointer"
                                >
                                    {salary > 0 ? "수정" : "입력"}
                                </button>
                            )}
                        </div>

                        {isEditingSalary ? (
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={salaryInput}
                                    onChange={(e) => setSalaryInput(e.target.value)}
                                    placeholder="월급 입력 (원)"
                                    className="flex-1 h-10 border-2 border-black px-3 text-sm font-black font-mono outline-none focus:border-[#E63946]"
                                    onKeyDown={(e) => e.key === "Enter" && handleSalarySave()}
                                />
                                <button onClick={handleSalarySave} className="px-3 py-1 bg-black text-white text-xs font-black border-2 border-black hover:bg-[#E63946] transition-all cursor-pointer">확인</button>
                                <button onClick={() => setIsEditingSalary(false)} className="px-3 py-1 bg-white text-black text-xs font-black border-2 border-black hover:bg-slate-100 transition-all cursor-pointer">취소</button>
                            </div>
                        ) : (
                            <p className="text-2xl font-black font-mono text-black">
                                {salary > 0 ? formatCurrency(salary) : <span className="text-slate-300 text-base">미입력</span>}
                            </p>
                        )}
                    </div>

                    {/* 요약 카드 */}
                    <div className="bg-black text-white border-2 border-black p-4 geo-shadow">
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">총 이체액</p>
                                <p className="text-sm font-black font-mono mt-0.5 text-[#E63946]">{formatCurrency(totalTransfer)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">이체 진행</p>
                                <p className="text-sm font-black font-mono mt-0.5">{checkedCount} / {data.accounts.length}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">잔여 월급</p>
                                <p className={`text-sm font-black font-mono mt-0.5 ${remaining !== null && remaining < 0 ? "text-[#E63946]" : "text-emerald-400"}`}>
                                    {remaining !== null ? formatCurrency(remaining) : "-"}
                                </p>
                            </div>
                        </div>
                        {salary > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-black text-slate-400">
                                    <span>분배율</span>
                                    <span>{usedPct}%</span>
                                </div>
                                <div className="h-3 w-full bg-neutral-800 border border-neutral-600 overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ${usedPct >= 100 ? "bg-[#E63946]" : usedPct >= 80 ? "bg-amber-400" : "bg-emerald-400"}`}
                                        style={{ width: `${usedPct}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 통장별 이체 현황 */}
                    <div className="bg-white border-2 border-black p-5 geo-shadow">
                        <div className="pb-3 border-b-2 border-black mb-4">
                            <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles className="h-4 w-4 text-[#E63946]" /> 통장별 이체 현황
                            </h3>
                        </div>

                        <div className="divide-y divide-black/10">
                            {data.accounts.map((a, idx) => {
                                // 첫번째(머니통장 생활비)는 livingAmount로 표시
                                const displayAmount = idx === 0 ? livingAmount : a.amount;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => onToggleAccount(idx)}
                                        className="flex items-center justify-between py-3.5 group cursor-pointer hover:bg-slate-50 px-2 transition-colors select-none"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className={`h-5 w-5 border-2 border-black flex items-center justify-center transition-all ${
                                                    a.checked ? "bg-black text-white" : "bg-white text-black"
                                                }`}
                                            >
                                                {a.checked && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                                            </div>
                                            <div>
                                                <p className={`text-xs font-black uppercase tracking-wide ${a.checked ? "text-slate-400 line-through" : "text-black"}`}>
                                                    {a.name}
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-extrabold font-mono mt-0.5">{formatCurrency(displayAmount)}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-mono font-black uppercase tracking-widest px-2.5 py-1 border-2 border-black ${
                                            a.checked ? "bg-black text-white" : "bg-white text-slate-400"
                                        }`}>
                      {a.checked ? "완료" : "대기"}
                    </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {activeSubTab === "fixed" && (
                <div className="space-y-4">
                    {/* 고정지출 */}
                    <div className="bg-white border-2 border-black p-5 geo-shadow">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
                            <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-black" /> 고정 지출
                            </h3>
                            <button
                                onClick={onAddFixed}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-black text-white border-2 border-black px-3 py-1.5 hover:bg-[#E63946] hover:border-[#E63946] active:translate-y-0.5 transition-colors cursor-pointer geo-shadow-sm"
                            >
                                <Plus className="h-3.5 w-3.5" /> 추가
                            </button>
                        </div>

                        {data.fixed.length === 0 ? (
                            <div className="text-center p-8 text-slate-400 text-xs font-medium uppercase tracking-widest">// 고정지출 목록이 비어있습니다.</div>
                        ) : (
                            <div className="space-y-1">
                                {data.fixed.map((f, idx) => (
                                    <div key={idx} className="flex items-center justify-between py-3 border-b border-black/10 last:border-0 hover:bg-slate-50 px-2 gap-2">
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="px-1.5 py-0.5 bg-black text-white text-[9px] font-black font-mono border border-black uppercase shrink-0">
                                                {f.day ? (f.day.includes("일") ? f.day : `${f.day}일`) : "N/A"}
                                            </div>
                                            <span className="text-xs font-black text-black truncate uppercase tracking-tight">{f.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 select-none">
                                            <span className="text-xs font-black text-[#E63946] font-mono whitespace-nowrap">-{formatCurrency(f.amount)}</span>
                                            <button onClick={() => onEditFixed(idx)} className="p-1 px-2 bg-white hover:bg-black text-black hover:text-white text-[10px] font-black border-2 border-black transition-all cursor-pointer">
                                                수정
                                            </button>
                                            <button onClick={() => onDeleteFixed(idx)} className="p-1 px-2 bg-white hover:bg-[#E63946] text-black hover:text-white text-[10px] font-black border-2 border-black transition-all cursor-pointer">
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center pt-3.5 mt-3.5 border-t-2 border-black font-black uppercase">
                                    <span className="text-xs text-black tracking-widest">고정지출 총 합계</span>
                                    <span className="text-sm text-[#E63946] font-mono">-{formatCurrency(totalFixed)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 경조사비 */}
                    <div className="bg-white border-2 border-black p-5 geo-shadow border-l-[8px] border-l-[#E63946]">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
                            <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-1.5">
                                <CalendarRange className="h-4 w-4 text-black" /> 경조사비
                            </h3>
                            <button
                                onClick={onAddEvent}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-black text-white border-2 border-black px-3 py-1.5 hover:bg-[#E63946] hover:border-[#E63946] active:translate-y-0.5 transition-colors cursor-pointer geo-shadow-sm"
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
                                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-black bg-[#F9F9F9] px-4 py-3 border-2 border-black font-bold gap-2 sm:gap-4">
                                        <span className="uppercase tracking-tight truncate w-full sm:w-auto">{e.name}</span>
                                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-1.5 sm:pt-0 border-t border-dashed border-black/10 sm:border-0 shrink-0 select-none">
                                            <span className="font-black text-[#E63946] font-mono">-{formatCurrency(e.amount)}</span>
                                            <button onClick={() => onDeleteEvent(idx)} className="p-1 px-2.5 bg-white hover:bg-[#E63946] text-black hover:text-white text-[10px] font-black border-2 border-black transition-all cursor-pointer">
                                                삭제
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center pt-3.5 mt-1 border-t-2 border-black text-xs font-black text-black">
                                    <span>경조사비 총 합계</span>
                                    <span className="font-mono text-[#E63946]">-{formatCurrency(totalEvents)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 할부 */}
                    <div className="bg-white border-2 border-black p-5 geo-shadow">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black mb-4">
                            <h3 className="text-sm font-black text-black uppercase tracking-widest flex items-center gap-1.5">
                                <CreditCard className="h-4 w-4 text-black" /> 할부
                            </h3>
                            <button
                                onClick={onAddInstallment}
                                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-black text-white border-2 border-black px-3 py-1.5 hover:bg-[#E63946] hover:border-[#E63946] active:translate-y-0.5 transition-colors cursor-pointer geo-shadow-sm"
                            >
                                <Plus className="h-3.5 w-3.5" /> 추가
                            </button>
                        </div>

                        {sortedInstallments.length === 0 ? (
                            <div className="text-center p-8 text-slate-400 text-xs font-medium uppercase tracking-widest">// 등록된 할부가 없습니다.</div>
                        ) : (
                            <div className="space-y-2">
                                {sortedInstallments.map((it) => {
                                    const st = instStatus(it);
                                    const badge =
                                        st.state === "active" ? { txt: `이번 달 ${st.n}/${it.months}회차`, cls: "bg-[#E63946] text-white border-[#E63946]" } :
                                            st.state === "upcoming" ? { txt: "예정", cls: "bg-white text-slate-400 border-black" } :
                                                st.state === "done" ? { txt: "완료", cls: "bg-black text-white border-black" } :
                                                    { txt: "-", cls: "bg-white text-slate-400 border-black" };
                                    return (
                                        <div key={it.id} className={`border-2 border-black px-3 py-3 ${st.state === "active" ? "bg-[#FFF5F5]" : "bg-[#F9F9F9]"}`}>
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <span className="text-xs font-black text-black truncate uppercase tracking-tight">{it.name}</span>
                                                    <span className={`text-[9px] font-mono font-black uppercase tracking-widest px-1.5 py-0.5 border-2 shrink-0 ${badge.cls}`}>
                                                        {badge.txt}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 select-none">
                                                    <button onClick={() => onEditInstallment && onEditInstallment(it.id)} className="p-1 px-2 bg-white hover:bg-black text-black hover:text-white text-[10px] font-black border-2 border-black transition-all cursor-pointer">
                                                        수정
                                                    </button>
                                                    <button onClick={() => onDeleteInstallment && onDeleteInstallment(it.id)} className="p-1 px-2 bg-white hover:bg-[#E63946] text-black hover:text-white text-[10px] font-black border-2 border-black transition-all cursor-pointer">
                                                        삭제
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-2 text-[10px] font-bold text-slate-500 font-mono">
                                                <span>{it.startMonth} 시작 · {it.months}개월 · 총 {formatCurrency(it.totalAmount)}</span>
                                                <span className="font-black text-[#E63946]">월 -{formatCurrency(it.monthlyAmount)}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex justify-between items-center pt-3.5 mt-1 border-t-2 border-black text-xs font-black text-black">
                                    <span>이번 달 할부금 합계</span>
                                    <span className="font-mono text-[#E63946]">-{formatCurrency(totalInstallmentThisMonth)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};